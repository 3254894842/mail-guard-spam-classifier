"""
邮件垃圾分类 Python 服务 — 完整版
====================================
基于你的 main_.py 逻辑，整合:
  - SVM 二分类 (svm_model.pkl + tfidf_vectorizer.pkl)
  - 朴素贝叶斯 二分类 (naive_bayes_model.pkl + vectorizer.pkl)
  - 垃圾类型多分类 (spam_classifier.joblib + label_encoder.joblib)
  - jieba 中文分词
  - 正则特征提取

运行前请先执行 python train.py 生成所有模型文件
"""

from flask import Flask, request, jsonify
from flask_cors import CORS
import os
import re
import jieba
import logging

logging.getLogger("jieba").setLevel(logging.WARNING)

app = Flask(__name__)
CORS(app)

# ── 模型全局变量 ────────────────────────────────────────────────────────────
svm_model = None
svm_vectorizer = None
nb_model = None
nb_vectorizer = None
spam_classifier = None     # 垃圾类型多分类器
label_encoder = None       # 标签编码器
models_loaded = False

SCRIPT_DIR = os.path.dirname(os.path.abspath(__file__))

# ── 正则模式（来自 main_.py）────────────────────────────────────────────────
REGEX_PATTERNS = {
    "url": re.compile(r"https?://\S+|www\.\S+"),
    "phone": re.compile(r"1[3-9]\d{9}"),
    "special_chars": re.compile(r'[!@#$%^&*(),.?":{}|<>！￥]'),
    "repeated_chars": re.compile(r"(.)\1{3,}"),
    "money": re.compile(r"[¥$￥]\d+"),
    "exclaim": re.compile(r"[！!]{3,}"),
}

# ── 关键词词典（用于规则降级 + 类型增强）──────────────────────────────────
SPAM_KEYWORDS: dict[str, list[str]] = {
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
        "私聊", "加好友", "telegram", "whatsapp", "加微信", "扫描二维码",
    ],
    "虚假中奖": [
        "您已中奖", "恭喜中奖", "幸运用户", "大奖", "抽中", "彩票",
        "奖金", "领奖", "千万大奖", "百万奖金",
    ],
}


def preprocess_with_regex(text: str) -> tuple[str, int, int]:
    """与 main_.py 保持一致的预处理函数"""
    text = REGEX_PATTERNS["url"].sub(" URL_TOKEN ", text)
    text = REGEX_PATTERNS["phone"].sub(" PHONE_TOKEN ", text)
    special_char_count = len(REGEX_PATTERNS["special_chars"].findall(text))
    repeated_patterns = len(REGEX_PATTERNS["repeated_chars"].findall(text))
    return text, special_char_count, repeated_patterns


def check_spam_svm(text: str) -> tuple[int, float]:
    """SVM 二分类 (来自 main_.py check_spam)"""
    text_tfidf = svm_vectorizer.transform([text])
    prediction = svm_model.predict(text_tfidf)
    if hasattr(svm_model, "predict_proba"):
        probabilities = svm_model.predict_proba(text_tfidf)
        spam_probability = float(probabilities[0][1]) * 100
    else:
        spam_probability = 100.0 if prediction[0] == 1 else 0.0
    return int(prediction[0]), spam_probability


def check_spam_nb(text: str) -> tuple[int, float]:
    """朴素贝叶斯 二分类 (来自 main_.py check_spam_with_naive_bayes)"""
    text_vectorized = nb_vectorizer.transform([text])
    prediction = nb_model.predict(text_vectorized)
    if hasattr(nb_model, "predict_proba"):
        probabilities = nb_model.predict_proba(text_vectorized)
        spam_probability = float(probabilities[0][1]) * 100
    else:
        spam_probability = 100.0 if prediction[0] == 1 else 0.0
    return int(prediction[0]), spam_probability


def classify_spam_type_ml(text: str) -> str:
    """使用多分类模型判断垃圾类型 (来自 main_.py classify_spam)"""
    tokenized_text = " ".join(jieba.cut(text))
    prediction = spam_classifier.predict([tokenized_text])[0]
    return str(label_encoder.inverse_transform([prediction])[0])


def classify_spam_type_keywords(full_text: str) -> str:
    """关键词匹配判断垃圾类型（当多分类模型不可用时）"""
    best_type = "一般垃圾邮件"
    best_hits = 0
    for spam_type, keywords in SPAM_KEYWORDS.items():
        hits = sum(1 for kw in keywords if kw in full_text)
        if hits > best_hits:
            best_hits = hits
            best_type = spam_type
    return best_type


def build_reasons(
    full_text: str,
    svm_pred: int, svm_prob: float,
    nb_pred: int, nb_prob: float,
) -> list[str]:
    """生成判定原因列表"""
    reasons = []
    method = "ML模型" if models_loaded else "规则"

    # 模型判断结果
    if svm_pred == 1:
        reasons.append(f"SVM模型判定为垃圾邮件 (置信度 {svm_prob:.1f}%)")
    else:
        reasons.append(f"SVM模型判定为正常邮件 (置信度 {100 - svm_prob:.1f}%)")

    if nb_pred == 1:
        reasons.append(f"朴素贝叶斯模型判定为垃圾邮件 (置信度 {nb_prob:.1f}%)")
    else:
        reasons.append(f"朴素贝叶斯模型判定为正常邮件 (置信度 {100 - nb_prob:.1f}%)")

    # 正则特征
    if REGEX_PATTERNS["url"].search(full_text):
        reasons.append("包含可疑外部链接")
    if REGEX_PATTERNS["phone"].search(full_text):
        reasons.append("包含手机号码")
    if REGEX_PATTERNS["money"].search(full_text):
        reasons.append("包含金额数字")
    if REGEX_PATTERNS["exclaim"].search(full_text):
        reasons.append("包含过多感叹号")
    if REGEX_PATTERNS["repeated_chars"].search(full_text):
        reasons.append("包含重复字符模式")

    # 关键词命中
    for spam_type, keywords in SPAM_KEYWORDS.items():
        hits = [kw for kw in keywords if kw in full_text]
        if hits:
            reasons.append(f"包含{spam_type}关键词: {'、'.join(hits[:3])}")

    return reasons[:8]


def load_models() -> bool:
    global svm_model, svm_vectorizer, nb_model, nb_vectorizer
    global spam_classifier, label_encoder, models_loaded

    required = {
        "svm_model.pkl": "SVM分类器",
        "tfidf_vectorizer.pkl": "TF-IDF向量化器",
        "naive_bayes_model.pkl": "朴素贝叶斯分类器",
        "vectorizer.pkl": "词袋向量化器",
    }
    optional = {
        "spam_classifier.joblib": "垃圾类型分类器",
        "label_encoder.joblib": "标签编码器",
    }

    missing = [f for f in required if not os.path.exists(os.path.join(SCRIPT_DIR, f))]
    if missing:
        print(f"[WARNING] 必需模型文件未找到: {missing}")
        print("[INFO] 将使用关键词规则作为备用方案")
        print("[INFO] 请运行 python train.py 生成模型文件")
        return False

    try:
        import joblib
        svm_model = joblib.load(os.path.join(SCRIPT_DIR, "svm_model.pkl"))
        svm_vectorizer = joblib.load(os.path.join(SCRIPT_DIR, "tfidf_vectorizer.pkl"))
        nb_model = joblib.load(os.path.join(SCRIPT_DIR, "naive_bayes_model.pkl"))
        nb_vectorizer = joblib.load(os.path.join(SCRIPT_DIR, "vectorizer.pkl"))

        # 尝试加载类型分类器（可选）
        sc_path = os.path.join(SCRIPT_DIR, "spam_classifier.joblib")
        le_path = os.path.join(SCRIPT_DIR, "label_encoder.joblib")
        if os.path.exists(sc_path) and os.path.exists(le_path):
            spam_classifier = joblib.load(sc_path)
            label_encoder = joblib.load(le_path)
            print("[INFO] 垃圾类型多分类器加载成功")
        else:
            print("[INFO] 垃圾类型分类器未找到，将使用关键词匹配判断类型")

        models_loaded = True
        print("[INFO] 核心 ML 模型加载成功 (SVM + 朴素贝叶斯)")
        return True

    except Exception as e:
        print(f"[ERROR] 加载模型失败: {e}")
        return False


def rule_based_classify(text: str, subject: str = "", from_addr: str = "") -> dict:
    """纯规则匹配（ML 模型不可用时使用）"""
    full_text = f"{subject} {from_addr} {text}"
    score = 0
    reasons = []

    for spam_type, keywords in SPAM_KEYWORDS.items():
        hits = [kw for kw in keywords if kw in full_text]
        if hits:
            n = len(hits)
            type_score = 18 if n == 1 else (30 if n == 2 else min(n * 13, 50))
            score += type_score
            reasons.append(f"包含{spam_type}关键词: {'、'.join(hits[:3])}")

    for name, pattern in [
        ("包含可疑链接", REGEX_PATTERNS["url"]),
        ("包含手机号码", REGEX_PATTERNS["phone"]),
        ("包含金额数字", REGEX_PATTERNS["money"]),
        ("包含过多感叹号", REGEX_PATTERNS["exclaim"]),
        ("包含重复字符", REGEX_PATTERNS["repeated_chars"]),
    ]:
        if pattern.search(full_text):
            score += 10
            reasons.append(name)

    score = min(score, 100)
    is_spam = score >= 30
    spam_type = classify_spam_type_keywords(full_text) if is_spam else "正常邮件"
    confidence = min(60 + score * 0.4, 99) if is_spam else min(60 + (100 - score) * 0.4, 99)

    return {
        "isSpam": is_spam,
        "spamScore": round(score, 1),
        "spamType": spam_type,
        "reasons": reasons[:8],
        "confidence": round(confidence, 1),
        "method": "rule_based",
        "svmScore": None,
        "nbScore": None,
    }


def ml_classify(text: str, subject: str = "", from_addr: str = "") -> dict:
    """完整 ML 分类（SVM + 朴素贝叶斯 + 类型判断）"""
    full_text = f"{subject} {text}"

    # 1. 正则预处理（来自 main_.py）
    processed_text, special_count, repeated_count = preprocess_with_regex(full_text)

    # 2. SVM 分类
    svm_pred, svm_prob = check_spam_svm(processed_text)

    # 3. 朴素贝叶斯分类
    nb_pred, nb_prob = check_spam_nb(processed_text)

    # 4. 加权融合 (SVM权重0.6, NB权重0.4 — 与 main_.py 一致)
    spam_score = svm_prob * 0.6 + nb_prob * 0.4
    is_spam = spam_score >= 50

    # 5. 判断垃圾类型
    if is_spam:
        if spam_classifier is not None and label_encoder is not None:
            try:
                spam_type = classify_spam_type_ml(processed_text)
            except Exception:
                spam_type = classify_spam_type_keywords(full_text)
        else:
            spam_type = classify_spam_type_keywords(full_text)
    else:
        spam_type = "正常邮件"

    # 6. 生成判定原因
    reasons = build_reasons(full_text, svm_pred, svm_prob, nb_pred, nb_prob)

    confidence = min(60 + abs(spam_score - 50) * 0.8, 99)

    return {
        "isSpam": bool(is_spam),
        "spamScore": round(spam_score, 1),
        "spamType": spam_type,
        "reasons": reasons,
        "confidence": round(confidence, 1),
        "method": "ml_model",
        "svmScore": round(svm_prob, 1),
        "nbScore": round(nb_prob, 1),
    }


# ── Flask 路由 ───────────────────────────────────────────────────────────────

@app.route("/healthz", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "modelsLoaded": models_loaded,
        "hasTypeClassifier": spam_classifier is not None,
        "method": "ml_model" if models_loaded else "rule_based",
    })


@app.route("/classify", methods=["POST"])
def classify():
    data = request.get_json()
    if not data or "text" not in data:
        return jsonify({"error": "请提供 text 字段"}), 400

    text = str(data.get("text", ""))
    subject = str(data.get("subject", ""))
    from_addr = str(data.get("from", ""))

    if not text.strip() and not subject.strip():
        return jsonify({
            "isSpam": False,
            "spamScore": 0.0,
            "spamType": "正常邮件",
            "reasons": [],
            "confidence": 95.0,
            "method": "empty_input",
            "svmScore": None,
            "nbScore": None,
        })

    try:
        if models_loaded:
            result = ml_classify(text, subject, from_addr)
        else:
            result = rule_based_classify(text, subject, from_addr)
        return jsonify(result)
    except Exception as e:
        print(f"[ERROR] 分类失败: {e}")
        result = rule_based_classify(text, subject, from_addr)
        result["method"] = "rule_based_fallback"
        return jsonify(result)


@app.route("/model-info", methods=["GET"])
def model_info():
    return jsonify({
        "modelsLoaded": models_loaded,
        "hasTypeClassifier": spam_classifier is not None,
        "method": "ml_model (SVM + 朴素贝叶斯)" if models_loaded else "rule_based (关键词匹配)",
        "instructions": "运行 python train.py 训练模型" if not models_loaded else "模型已就绪",
    })


if __name__ == "__main__":
    print("=" * 55)
    print("  邮件卫士 — Python 分类服务启动")
    print("=" * 55)
    load_models()
    port = int(os.environ.get("CLASSIFIER_PORT", 5001))
    print(f"[INFO] 服务地址: http://0.0.0.0:{port}")
    app.run(host="0.0.0.0", port=port, debug=False)
