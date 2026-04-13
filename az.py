import pandas as pd
from sklearn.model_selection import train_test_split
from sklearn.feature_extraction.text import TfidfVectorizer
from sklearn.svm import SVC
from sklearn.metrics import accuracy_score, classification_report, confusion_matrix

data0 = pd.read_csv('output_label_0.csv')
data1 = pd.read_csv('output_label_1.csv')

data = pd.concat([data0, data1], ignore_index=True)

print(data.head())

X = data['邮件']
y = data['标签']

vectorizer = TfidfVectorizer(max_features=5000)
X_tfidf = vectorizer.fit_transform(X)

X_train, X_test, y_train, y_test = train_test_split(X_tfidf, y, test_size=0.2, random_state=42)

svm_model = SVC(kernel='linear', probability=True)
svm_model.fit(X_train, y_train)

y_pred = svm_model.predict(X_test)

accuracy = accuracy_score(y_test, y_pred)
print(f'模型准确率: {accuracy:.4f}')
print('混淆矩阵:')
print(confusion_matrix(y_test, y_pred))
print('分类报告:')
print(classification_report(y_test, y_pred))

import joblib
joblib.dump(svm_model, 'svm_model.pkl')
joblib.dump(vectorizer, 'tfidf_vectorizer.pkl')