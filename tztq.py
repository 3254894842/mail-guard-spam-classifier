import pandas as pd
from sklearn.feature_extraction.text import TfidfVectorizer

file_path = "message2.csv"
data = pd.read_csv(file_path)

X = data['message']

vectorizer = TfidfVectorizer()
X_tfidf = vectorizer.fit_transform(X)

feature_names = vectorizer.get_feature_names_out()
print("前10个特征词汇:", feature_names[:10])
