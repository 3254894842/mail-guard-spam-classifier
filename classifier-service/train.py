"""
垃圾邮件模型训练脚本（整合版）
=================================
支持以下数据格式（自动识别）:
  格式A: output_label_0.csv + output_label_1.csv  (列: 邮件, 标签)
  格式B: datae.csv                                 (列: label, message)
  格式C: 1.csv (垃圾邮件, 列: 邮件) + output_label_0.csv (正常邮件)

生成文件:
  svm_model.pkl              SVM 二分类器
  tfidf_vectorizer.pkl       TF-IDF 向量化器
  naive_bayes_model.pkl      朴素贝叶斯分类器
  vectorizer.pkl             词袋向量化器
  spam_classifier.joblib     垃圾类型多分类器
  label_encoder.joblib       类型标签编码器
  training_report.txt        训练报告
"""

import pandas as pd
import numpy as np
import jieba
import joblib
import os
import logging

logging.getLogger("jieba").setLevel(logging.WARNING)

from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer, CountVectorizer
from sklearn.svm import SVC
from sklearn.naive_bayes import MultinomialNB
from sklearn.preprocessing import LabelEncoder
from sklearn.pipeline import Pipeline
from sklearn.metrics import (
    accuracy_score, precision_score, recall_score,
    f1_score, roc_auc_score,
)

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

SPAM_TYPE_KEYWORDS: dict[str, list[str]] = {
    "金融诈骗": [
        "贷款", "低息", "无抵押", "秒到账", "放款", "借钱", "急用钱",
        "套现", "刷单", "兼职赚钱", "日赚", "月入过万", "投资理财",
        "高收益", "稳定回报", "内幕消息", "股票推荐", "虚拟货币", "比特币",
        "理财", "年化", "收益率", "基金", "分红",
    ],
    "促销广告": [
        "免费领取", "限时优惠", "大促", "打折", "折扣", "优惠券", "抢购", "秒杀",
        "返利", "返现", "红包", "中奖", "恭喜您", "抽奖", "积分兑换", "特价",
        "超低价", "爆款", "热卖", "清仓", "买一送一", "全场五折", "限量",
        "品牌特卖", "商城", "购物节", "双十一", "618", "满减",
    ],
    "账号钓鱼": [
        "账号被盗", "密码过期", "账号异常", "立即验证", "身份验证",
        "冻结", "封号", "实名认证", "补全信息", "银行卡", "转账",
        "登录异常", "异地登录", "安全验证", "点击确认",
    ],
    "诈骗链接": [
        "点击链接", "扫码", "二维码", "立即点击", "马上领取", "加我",
        "私聊", "加好友", "telegram", "whatsapp", "加微信",
    ],
    "虚假中奖": [
        "您已中奖", "恭喜中奖", "幸运用户", "大奖", "抽中", "彩票",
        "奖金", "领奖", "千万大奖", "百万奖金",
    ],
}


def tokenize(text: str) -> str:
    return " ".join(jieba.cut(str(text)))


def auto_label_spam_type(text: str) -> str:
    best_type = "一般垃圾邮件"
    best_count = 0
    for spam_type, keywords in SPAM_TYPE_KEYWORDS.items():
        count = sum(1 for kw in keywords if kw in text)
        if count > best_count:
            best_count = count
            best_type = spam_type
    return best_type


def load_data(data_dir: str) -> pd.DataFrame:
    """自动识别数据格式并加载"""

    # ── 格式B: datae.csv (label, message) ──────────────────────────────────
    datae_path = os.path.join(data_dir, "datae.csv")
    if os.path.exists(datae_path):
        print("  检测到 datae.csv，使用格式B (label, message)")
        df = pd.read_csv(datae_path, encoding="utf-8")
        if "label" in df.columns and "message" in df.columns:
            df = df.rename(columns={"label": "标签", "message": "邮件"})
            df = df[["邮件", "标签"]].dropna()
            df["标签"] = df["标签"].astype(int)
            df["邮件"] = df["邮件"].astype(str).str.strip()
            df = df[df["邮件"].str.len() > 2]
            normal = (df["标签"] == 0).sum()
            spam = (df["标签"] == 1).sum()
            print(f"  正常邮件: {normal} 条  垃圾邮件: {spam} 条")
            return df.sample(frac=1, random_state=42).reset_index(drop=True)

    # ── 格式A: output_label_0.csv + output_label_1.csv ─────────────────────
    path0 = os.path.join(data_dir, "output_label_0.csv")
    path1 = os.path.join(data_dir, "output_label_1.csv")
    if os.path.exists(path0) and os.path.exists(path1):
        print("  检测到 output_label_0/1.csv，使用格式A")
        normal = pd.read_csv(path0, encoding="utf-8")
        spam = pd.read_csv(path1, encoding="utf-8")
        # 如果没有标签列，自动添加
        if "标签" not in normal.columns:
            normal["标签"] = 0
        if "标签" not in spam.columns:
            spam["标签"] = 1
        print(f"  正常邮件: {len(normal)} 条  垃圾邮件: {len(spam)} 条")
        data = pd.concat([normal, spam], ignore_index=True)
        data = data.dropna(subset=["邮件"])
        data["邮件"] = data["邮件"].astype(str).str.strip()
        data = data[data["邮件"].str.len() > 2]
        data["标签"] = data["标签"].astype(int)
        return data.sample(frac=1, random_state=42).reset_index(drop=True)

    # ── 格式C: 1.csv (垃圾邮件，只有邮件列) ────────────────────────────────
    spam_path = os.path.join(data_dir, "1.csv")
    if os.path.exists(spam_path) and os.path.exists(path0):
        print("  检测到 1.csv + output_label_0.csv，使用格式C")
        spam_df = pd.read_csv(spam_path, encoding="utf-8")
        spam_col = "邮件" if "邮件" in spam_df.columns else spam_df.columns[0]
        spam_df = spam_df.rename(columns={spam_col: "邮件"})
        spam_df["标签"] = 1

        normal_df = pd.read_csv(path0, encoding="utf-8")
        normal_col = "邮件" if "邮件" in normal_df.columns else normal_df.columns[0]
        normal_df = normal_df.rename(columns={normal_col: "邮件"})
        normal_df["标签"] = 0

        print(f"  正常邮件: {len(normal_df)} 条  垃圾邮件: {len(spam_df)} 条")
        data = pd.concat([normal_df[["邮件","标签"]], spam_df[["邮件","标签"]]], ignore_index=True)
        data = data.dropna(subset=["邮件"])
        data["邮件"] = data["邮件"].astype(str).str.strip()
        data = data[data["邮件"].str.len() > 2]
        data["标签"] = data["标签"].astype(int)
        return data.sample(frac=1, random_state=42).reset_index(drop=True)

    raise FileNotFoundError(
        f"\n找不到训练数据！请将以下文件放到 {data_dir} 目录:\n"
        f"  方式1: output_label_0.csv (正常邮件) + output_label_1.csv (垃圾邮件)\n"
        f"  方式2: datae.csv (列: label, message)\n"
        f"  方式3: 1.csv (垃圾邮件) + output_label_0.csv (正常邮件)\n"
        f"  CSV 列名: 邮件 (内容), 标签 (0=正常, 1=垃圾)\n"
    )


def train_svm(X_train, y_train, X_test, y_test):
    print("\n[SVM] 训练中...")
    model = SVC(kernel="linear", probability=True, random_state=42)
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]
    metrics = {
        "accuracy":  accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred, zero_division=0),
        "recall":    recall_score(y_test, y_pred, zero_division=0),
        "f1":        f1_score(y_test, y_pred, zero_division=0),
        "roc_auc":   roc_auc_score(y_test, y_proba),
    }
    print(f"       准确率: {metrics['accuracy']:.4f}  F1: {metrics['f1']:.4f}  ROC-AUC: {metrics['roc_auc']:.4f}")
    return model, metrics


def train_naive_bayes(X_train, y_train, X_test, y_test):
    print("\n[NB]  训练中...")
    model = MultinomialNB()
    model.fit(X_train, y_train)
    y_pred = model.predict(X_test)
    y_proba = model.predict_proba(X_test)[:, 1]
    metrics = {
        "accuracy":  accuracy_score(y_test, y_pred),
        "precision": precision_score(y_test, y_pred, zero_division=0),
        "recall":    recall_score(y_test, y_pred, zero_division=0),
        "f1":        f1_score(y_test, y_pred, zero_division=0),
        "roc_auc":   roc_auc_score(y_test, y_proba),
    }
    print(f"       准确率: {metrics['accuracy']:.4f}  F1: {metrics['f1']:.4f}  ROC-AUC: {metrics['roc_auc']:.4f}")
    return model, metrics


def train_spam_type_classifier(spam_df: pd.DataFrame):
    print("\n[TYPE] 训练垃圾类型多分类器...")
    spam_df = spam_df.copy()
    spam_df["spam_type"] = spam_df["邮件"].apply(auto_label_spam_type)
    type_counts = spam_df["spam_type"].value_counts()
    print(f"       类型分布:\n{type_counts.to_string()}")

    X_tok = spam_df["邮件"].apply(tokenize)
    le = LabelEncoder()
    y_type = le.fit_transform(spam_df["spam_type"])

    pipeline = Pipeline([
        ("vec", TfidfVectorizer(max_features=8000, ngram_range=(1, 2))),
        ("clf", SVC(kernel="linear", probability=True, random_state=42)),
    ])
    pipeline.fit(X_tok, y_type)

    X_tr, X_te, y_tr, y_te = train_test_split(X_tok, y_type, test_size=0.2, random_state=42)
    pipeline_eval = Pipeline([
        ("vec", TfidfVectorizer(max_features=8000, ngram_range=(1, 2))),
        ("clf", SVC(kernel="linear", probability=True, random_state=42)),
    ])
    pipeline_eval.fit(X_tr, y_tr)
    acc = accuracy_score(y_te, pipeline_eval.predict(X_te))
    print(f"       类型分类准确率: {acc:.4f}")
    return pipeline, le


def main():
    print("=" * 55)
    print("  邮件卫士 — 模型训练")
    print("=" * 55)

    data_dir = os.environ.get("DATA_DIR", SCRIPT_DIR)

    print("\n[1/5] 加载数据...")
    data = load_data(data_dir)
    print(f"  清洗后总计: {len(data)} 条")

    if len(data) < 20:
        print("\n[警告] 训练数据太少（少于20条），模型效果可能很差")
        print("       建议至少提供100条以上的训练数据")

    print("\n[2/5] jieba 分词（请稍候）...")
    X_text = data["邮件"].apply(tokenize)
    y = data["标签"]

    X_tr_txt, X_te_txt, y_train, y_test = train_test_split(
        X_text, y, test_size=0.2, random_state=42, stratify=y
    )
    print(f"       训练集 {len(X_tr_txt)} 条 / 测试集 {len(X_te_txt)} 条")

    print("\n[3/5] 向量化...")
    tfidf = TfidfVectorizer(max_features=10000, ngram_range=(1, 2))
    X_tr_tfidf = tfidf.fit_transform(X_tr_txt)
    X_te_tfidf = tfidf.transform(X_te_txt)

    bow = CountVectorizer(max_features=10000)
    X_tr_bow = bow.fit_transform(X_tr_txt)
    X_te_bow = bow.transform(X_te_txt)

    print("\n[4/5] 训练核心模型...")
    svm_model, svm_metrics = train_svm(X_tr_tfidf, y_train, X_te_tfidf, y_test)
    nb_model, nb_metrics = train_naive_bayes(X_tr_bow, y_train, X_te_bow, y_test)

    print("\n[5/5] 训练垃圾类型分类器...")
    spam_data = data[data["标签"] == 1].copy()
    type_pipeline, label_encoder = train_spam_type_classifier(spam_data)

    print("\n[SAVE] 保存模型文件...")
    joblib.dump(svm_model,     os.path.join(SCRIPT_DIR, "svm_model.pkl"))
    joblib.dump(tfidf,         os.path.join(SCRIPT_DIR, "tfidf_vectorizer.pkl"))
    joblib.dump(nb_model,      os.path.join(SCRIPT_DIR, "naive_bayes_model.pkl"))
    joblib.dump(bow,           os.path.join(SCRIPT_DIR, "vectorizer.pkl"))
    joblib.dump(type_pipeline, os.path.join(SCRIPT_DIR, "spam_classifier.joblib"))
    joblib.dump(label_encoder, os.path.join(SCRIPT_DIR, "label_encoder.joblib"))

    report = f"""邮件卫士 — 模型训练报告
========================
训练样本: {len(X_tr_txt)} 条
测试样本: {len(X_te_txt)} 条

SVM 模型
---------
准确率: {svm_metrics['accuracy']:.4f}
精确率: {svm_metrics['precision']:.4f}
召回率: {svm_metrics['recall']:.4f}
F1分数: {svm_metrics['f1']:.4f}
ROC-AUC: {svm_metrics['roc_auc']:.4f}

朴素贝叶斯模型
--------------
准确率: {nb_metrics['accuracy']:.4f}
精确率: {nb_metrics['precision']:.4f}
召回率: {nb_metrics['recall']:.4f}
F1分数: {nb_metrics['f1']:.4f}
ROC-AUC: {nb_metrics['roc_auc']:.4f}
"""
    with open(os.path.join(SCRIPT_DIR, "training_report.txt"), "w", encoding="utf-8") as f:
        f.write(report)

    print("\n" + "=" * 55)
    print("训练完成！生成的文件:")
    print("  svm_model.pkl            SVM 二分类器")
    print("  tfidf_vectorizer.pkl     TF-IDF 向量化器")
    print("  naive_bayes_model.pkl    朴素贝叶斯分类器")
    print("  vectorizer.pkl           词袋向量化器")
    print("  spam_classifier.joblib   垃圾类型多分类器")
    print("  label_encoder.joblib     类型标签编码器")
    print("  training_report.txt      训练报告")
    print("\n下一步: python app.py")
    print("=" * 55)


if __name__ == "__main__":
    main()
