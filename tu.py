import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score, precision_score, recall_score, f1_score, roc_auc_score, roc_curve, auc, confusion_matrix, precision_recall_curve, average_precision_score
import joblib
import matplotlib.pyplot as plt
import seaborn as sns

normal_sms = pd.read_csv('output_label_0.csv', encoding='utf-8')
spam_sms = pd.read_csv('output_label_1.csv', encoding='utf-8')

normal_sms['标签'] = 0
spam_sms['标签'] = 1
data = pd.concat([normal_sms, spam_sms], ignore_index=True)

data = data.sample(frac=1).reset_index(drop=True)

X = data['邮件']
y = data['标签']

X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)

vectorizer = TfidfVectorizer(stop_words='english', max_features=10000, ngram_range=(1, 2))
X_train_tfidf = vectorizer.fit_transform(X_train)
X_test_tfidf = vectorizer.transform(X_test)

model = SVC(kernel='linear', probability=True)
model.fit(X_train_tfidf, y_train)

y_pred = model.predict(X_test_tfidf)
y_pred_proba = model.predict_proba(X_test_tfidf)[:, 1]  # 获取预测概率

accuracy = accuracy_score(y_test, y_pred)
precision = precision_score(y_test, y_pred)
recall = recall_score(y_test, y_pred)
f1 = f1_score(y_test, y_pred)
roc_auc = roc_auc_score(y_test, y_pred_proba)

print(f"准确率（Accuracy）: {accuracy:.4f}")
print(f"精确率（Precision）: {precision:.4f}")
print(f"召回率（Recall）: {recall:.4f}")
print(f"F1分数（F1 Score）: {f1:.4f}")
print(f"ROC-AUC: {roc_auc:.4f}")

fpr, tpr, _ = roc_curve(y_test, y_pred_proba)
roc_auc_value = auc(fpr, tpr)

plt.figure(figsize=(8, 6))
plt.plot(fpr, tpr, color='darkorange', lw=2, label=f'ROC curve (area = {roc_auc_value:.2f})')
plt.plot([0, 1], [0, 1], color='navy', lw=2, linestyle='--')
plt.xlim([0.0, 1.0])
plt.ylim([0.0, 1.05])
plt.xlabel('False Positive Rate')
plt.ylabel('True Positive Rate')
plt.title('Receiver Operating Characteristic (ROC) Curve')
plt.legend(loc="lower right")
plt.show()

precision, recall, thresholds = precision_recall_curve(y_test, y_pred_proba)
ap = average_precision_score(y_test, y_pred_proba)

plt.figure(figsize=(8, 6))
plt.plot(recall, precision, label=f'AP={ap:.2f}')
plt.xlabel('Recall')
plt.ylabel('Precision')
plt.title('Precision-Recall Curve')
plt.legend()
plt.show()

cm = confusion_matrix(y_test, y_pred)

plt.figure(figsize=(6, 6))
sns.heatmap(cm, annot=True, fmt='d', cmap='Blues', xticklabels=['Not Spam', 'Spam'], yticklabels=['Not Spam', 'Spam'])
plt.xlabel('Predicted')
plt.ylabel('Actual')
plt.title('Confusion Matrix')
plt.show()

plt.figure(figsize=(8, 6))
plt.hist(y_pred_proba[y_test == 1], bins=20, alpha=0.5, label='True Positive')
plt.hist(y_pred_proba[y_test == 0], bins=20, alpha=0.5, label='False Positive')
plt.xlabel('Confidence')
plt.ylabel('Number of Samples')
plt.title('Confidence Distribution')
plt.legend()
plt.show()