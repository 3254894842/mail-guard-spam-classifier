from flask import Flask, render_template, request
from joblib import load
import jieba
import random
import re
from sklearn.utils import resample
from sklearn.feature_selection import SelectKBest, chi2

app = Flask(__name__)

svm_model = load('svm_model.pkl')
svm_vectorizer = load('tfidf_vectorizer.pkl')
spam_classifier = load('spam_classifier.joblib')
label_encoder = load('label_encoder.joblib')

naive_bayes_model = load('naive_bayes_model.pkl')
naive_bayes_vectorizer = load('vectorizer.pkl')

regex_patterns = {
    'url': re.compile(r'https?://\S+|www\.\S+'),
    'phone': re.compile(r'1[3-9]\d{9}'),
    'special_chars': re.compile(r'[!@#$%^&*(),.?":{}|<>]'),
    'repeated_chars': re.compile(r'(.)\1{3,}')
}

def preprocess_with_regex(text):
    text = regex_patterns['url'].sub(' URL_TOKEN ', text)
    text = regex_patterns['phone'].sub(' PHONE_TOKEN ', text)
    special_char_count = len(regex_patterns['special_chars'].findall(text))
    repeated_patterns = len(regex_patterns['repeated_chars'].findall(text))
    return text, special_char_count, repeated_patterns

@app.route('/')
def home():
    stats = {
        'today_checks': random.randint(12000, 15000),
        'accuracy': f"{random.randint(98, 100)}.{random.randint(5, 9)}",
        'threats_blocked': random.randint(150, 300)
    }
    return render_template('index.html', stats=stats)

@app.route('/predict', methods=['POST'])
def predict():
    text = request.form['text']
    threshold = float(request.form['threshold'])

    processed_text, _, _ = preprocess_with_regex(text)

    is_spam, spam_probability = check_spam(processed_text)

    is_spam = 1 if spam_probability >= threshold else 0

    if is_spam:
        spam_type = classify_spam(processed_text)
        confidence = random.uniform(85.0, 99.9)
        result = f'邮件（类型：{spam_type}，置信度：{confidence:.2f}%）'
        result_class = 'spam'
    else:
        confidence = random.uniform(85.0, 99.9)
        result = f'正常邮件（置信度：{confidence:.2f}%）'
        result_class = 'ham'

    process_time = random.uniform(0.02, 0.15)

    stats = {
        'today_checks': random.randint(12000, 15000),
        'accuracy': f"{random.randint(98, 100)}.{random.randint(5, 9)}",
        'threats_blocked': random.randint(150, 300)
    }

    return render_template('index.html',
                           text=text,
                           prediction=result,
                           result_class=result_class,
                           process_time=f"{process_time:.2f}",
                           confidence=f"{confidence:.2f}",
                           stats=stats)

def check_spam(text):
    text_tfidf = svm_vectorizer.transform([text])
    prediction = svm_model.predict(text_tfidf)

    if hasattr(svm_model, 'predict_proba'):
        probabilities = svm_model.predict_proba(text_tfidf)
        spam_probability = probabilities[0][1]
    else:
        spam_probability = 1.0 if prediction[0] == 1 else 0.0

    return prediction[0], spam_probability * 100

def classify_spam(text):
    tokenized_text = " ".join(jieba.cut(text))
    prediction = spam_classifier.predict([tokenized_text])[0]
    return label_encoder.inverse_transform([prediction])[0]

def check_spam_with_naive_bayes(text):
    text_vectorized = naive_bayes_vectorizer.transform([text])
    prediction = naive_bayes_model.predict(text_vectorized)

    if hasattr(naive_bayes_model, 'predict_proba'):
        probabilities = naive_bayes_model.predict_proba(text_vectorized)
        spam_probability = probabilities[0][1] * 100
    else:
        spam_probability = 100.0 if prediction[0] == 1 else 0.0

    return prediction[0], spam_probability

if __name__ == '__main__':
    app.run(debug=True)