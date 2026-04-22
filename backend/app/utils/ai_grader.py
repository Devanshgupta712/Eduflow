import os
import io
import json
import PyPDF2
import httpx

# Groq API Key — must be set via GROQ_API_KEY environment variable in Render
GROQ_API_KEY = os.environ.get("GROQ_API_KEY")
if not GROQ_API_KEY:
    print("[AI Grader] WARNING: GROQ_API_KEY not set. AI features will be disabled.")

# Llama-3.3-70b-versatile: Extremely fast and capable model on Groq
MODEL_NAME = "llama-3.3-70b-versatile"


def extract_text_from_pdf(pdf_bytes: bytes) -> str:
    """Extracts raw text from a PDF byte array."""
    try:
        reader = PyPDF2.PdfReader(io.BytesIO(pdf_bytes))
        extracted_text = []
        for page in reader.pages:
            text = page.extract_text()
            if text:
                extracted_text.append(text)
        return "\n".join(extracted_text)
    except Exception as e:
        print(f"[AI Grader] Error parsing PDF: {e}")
        return ""


def generate_assignment_instructions(topic: str) -> str:
    """
    Generates structured assignment instructions based on a topic string using Groq.
    """
    if not GROQ_API_KEY:
        return "AI not configured. Please contact admin."
        
    try:
        prompt = f"Create an assignment purely based on this topic/command: {topic}"
        
        with httpx.Client(timeout=40.0) as client:
            resp = client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": MODEL_NAME,
                    "messages": [
                        {"role": "system", "content": "You are a senior tech lead designing a challenging, real-world assignment for trainees. Output ONLY clean markdown format. Include Prerequisites, Objective, Constraints, and Grading Criteria. Keep it under 500 words."},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.5,
                    "max_tokens": 1024
                }
            )
            
        if resp.is_success:
            data = resp.json()
            return data["choices"][0]["message"]["content"].strip()
        else:
            print(f"[AI Grader] Groq generation error: {resp.status_code}")
            return "Failed to generate instructions via Groq. Please try again."
            
    except Exception as e:
        print(f"[AI Grader] Error generating assignment: {e}")
        return "Failed to generate instructions. Please try manually uploading a PDF."


def evaluate_submission(assignment_instructions: str, student_content: str, max_marks: int = 100) -> dict:
    """
    Evaluates a student's submission text/code against the assignment requirements using Groq.
    Returns a dict with `score` (integer) and `feedback` (str).
    """
    if not GROQ_API_KEY:
        return {"score": 0, "feedback": "AI Not Configured."}
        
    try:
        prompt = f"### ASSIGNMENT INSTRUCTIONS:\n{assignment_instructions}\n\n### STUDENT SUBMISSION:\n{student_content}\n\nEvaluate the student submission."
        
        with httpx.Client(timeout=40.0) as client:
            resp = client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}", "Content-Type": "application/json"},
                json={
                    "model": MODEL_NAME,
                    "messages": [
                        {
                            "role": "system", 
                            "content": (
                                f"You are an encouraging yet accurate coding instructor grading a submission. "
                                f"The submission may contain MULTIPLE problems. "
                                f"You MUST evaluate ALL problems and provide a single holistic score (out of {max_marks}). "
                                f"IMPORTANT: You MUST award partial credit fairly. If an assignment contains multiple problems (e.g., 5 problems) and the student only attempts one, their maximum possible score should STRICTLY correspond to the portion they completed (e.g., max 20-30%), even if that one answer is perfect. Do not give high marks for incomplete submissions. "
                                f"For the 'feedback' field, you MUST format your response as a visually clean Markdown string containing EXACTLY these exactly three headers: \n"
                                f"### 🌟 What You Did Well\n(list points here)\n\n"
                                f"### 📈 Areas for Improvement\n(list points here)\n\n"
                                f"### 💬 Overall Verdict\n(summary here)\n\n"
                                f"Return ONLY a strictly valid JSON object with EXACTLY two keys: 'score' (an integer) and 'feedback' (the formatted markdown string). "
                                f"Return no other text or markdown block outside the JSON."
                            )
                        },
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.3,
                    "max_tokens": 1024,
                    "response_format": {"type": "json_object"}
                }
            )
            
        if resp.is_success:
            data = resp.json()
            raw_content = data["choices"][0]["message"]["content"].strip()
            result_json = json.loads(raw_content)
            
            raw_score = result_json.get("score")
            try:
                # Handle cases where score might be a string like "85" or a float
                score_val = int(float(str(raw_score)))
            except (ValueError, TypeError):
                score_val = 0
                
            return {
                "score": score_val,
                "feedback": result_json.get("feedback", "No feedback provided by AI.")
            }
        else:
            print(f"[AI Grader] Groq grading error: {resp.status_code}")
            return {"score": 0, "feedback": f"AI Evaluation failed (Status {resp.status_code})."}
            
    except Exception as e:
        print(f"[AI Grader] Error grading submission: {e}")
        return {
            "score": 0,
            "feedback": "AI Evaluation failed. Please grade manually."
        }
