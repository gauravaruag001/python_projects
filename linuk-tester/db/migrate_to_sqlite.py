import json
import os
from sqlalchemy import create_engine, Column, Integer, String, Text
from sqlalchemy.orm import declarative_base, sessionmaker

Base = declarative_base()

class Question(Base):
    __tablename__ = 'questions'
    id = Column(Integer, primary_key=True)
    topic = Column(String, nullable=False)
    question = Column(String, nullable=False)
    options = Column(Text, nullable=False) # Store options as JSON string
    correct_answer = Column(String, nullable=False)
    explanation = Column(String, nullable=True)

def main():
    db_path = os.path.join(os.path.dirname(__file__), 'questions.db')
    json_path = os.path.join(os.path.dirname(__file__), 'local_questions.json')

    if not os.path.exists(json_path):
        print(f"Error: Could not find {json_path}")
        return

    # Delete existing DB if it exists
    if os.path.exists(db_path):
        print(f"Removing old database {db_path}...")
        os.remove(db_path)

    print(f"Creating SQLite database at {db_path}...")
    engine = create_engine(f'sqlite:///{db_path}')
    Base.metadata.create_all(engine)
    
    Session = sessionmaker(bind=engine)
    session = Session()

    print(f"Loading data from {json_path}...")
    with open(json_path, 'r', encoding='utf-8') as f:
        data = json.load(f)

    print(f"Migrating {len(data)} questions to SQLite...")
    for item in data:
        question = Question(
            id=item['id'],
            topic=item['topic'],
            question=item['question'],
            options=json.dumps(item['options']),
            correct_answer=item['correctAnswer'],
            explanation=item.get('explanation', '')
        )
        session.add(question)
    
    session.commit()
    print("Migration completed successfully!")

if __name__ == '__main__':
    main()
