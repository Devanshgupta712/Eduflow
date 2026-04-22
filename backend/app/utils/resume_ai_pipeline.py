import json
import os
import httpx
import asyncio
from typing import Dict, Any, List, Optional
from fastapi import HTTPException

# Groq Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PRIMARY_MODEL = "llama-3.1-70b-versatile"
FALLBACK_MODEL = "mixtral-8x7b-32768"

async def get_groq_completion(
    messages: List[Dict[str, str]], 
    temperature: float = 0.7, 
    max_tokens: int = 4000,
    model: str = PRIMARY_MODEL,
    retries: int = 3,
    json_mode: bool = True
) -> str:
    """Reusable Groq API call function with retry logic and fallback."""
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="Groq API Key not configured")
        
    payload = {
        "model": model,
        "messages": messages,
        "temperature": temperature,
        "max_tokens": max_tokens
    }
    
    if json_mode:
        payload["response_format"] = {"type": "json_object"}
        
    async with httpx.AsyncClient() as client:
        for attempt in range(retries):
            try:
                response = await client.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                    json=payload,
                    timeout=60.0
                )
                
                if response.status_code == 429: # Rate limit
                    if attempt < retries - 1:
                        wait_time = (attempt + 1) * 2
                        await asyncio.sleep(wait_time)
                        continue
                    elif model == PRIMARY_MODEL:
                        # Fallback to another model
                        return await get_groq_completion(messages, temperature, max_tokens, FALLBACK_MODEL, retries=1)
                
                if response.status_code != 200:
                    error_detail = response.text
                    try:
                        error_json = response.json()
                        error_detail = error_json.get("error", {}).get("message", response.text)
                    except:
                        pass
                    
                    if attempt < retries - 1:
                        await asyncio.sleep(1)
                        continue
                    raise HTTPException(status_code=500, detail=f"Groq API Error: {error_detail}")
                    
                data = response.json()
                return data["choices"][0]["message"]["content"]
                
            except Exception as e:
                if attempt < retries - 1:
                    await asyncio.sleep(1)
                    continue
                if isinstance(e, HTTPException):
                    raise e
                raise HTTPException(status_code=500, detail=f"LLM Generation failed: {str(e)}")
    
    raise HTTPException(status_code=500, detail="Failed to get completion after multiple retries")

async def analyze_jd(job_description: str) -> Dict[str, Any]:
    """1. analyze_jd(job_description) - Extract skills, tools, keywords."""
    system_prompt = """You are an expert recruitment analyzer. Analyze the provided Job Description.
    Extract the essential technical skills, soft skills, specific tools mentioned, and high-impact keywords.
    Return the result in a strict JSON format.
    
    EXPECTED OUTPUT:
    {
      "skills": ["Python", "Machine Learning", ...],
      "tools": ["Git", "Docker", ...],
      "keywords": ["Agile", "Microservices", ...]
    }"""
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Analyze this Job Description:\n{job_description}"}
    ]
    
    response_str = await get_groq_completion(messages, temperature=0.2, max_tokens=800)
    return json.loads(response_str)

async def parse_resume(resume_text: str) -> Dict[str, Any]:
    """2. parse_resume(resume_text) - Convert resume into structured JSON."""
    system_prompt = """You are a highly accurate resume parser. Convert the provided unstructured resume text into a clean, structured JSON format.
    
    STRICT RULES:
    1. Do NOT invent or hallucinate any details.
    2. Maintain the user's original experience and project details accurately.
    3. Ensure the JSON structure matches exactly.
    
    EXPECTED OUTPUT:
    {
      "summary": "Full professional summary",
      "skills": ["Skill 1", "Skill 2"],
      "experience": [
        {
          "company": "Company Name",
          "role": "Job Title",
          "from": "Start Date",
          "to": "End Date",
          "bullets": ["Achievement 1", "Achievement 2"]
        }
      ],
      "projects": [
        {
          "name": "Project Name",
          "tech": "Technologies used",
          "description": "Short project description"
        }
      ]
    }"""
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Parse this resume text:\n{resume_text}"}
    ]
    
    response_str = await get_groq_completion(messages, temperature=0.1, max_tokens=1200)
    return json.loads(response_str)

async def analyze_gap(resume_json: Dict[str, Any], jd_json: Dict[str, Any]) -> Dict[str, Any]:
    """3. analyze_gap(resume_json, jd_json) - Compare resume against JD requirements."""
    system_prompt = """Compare the candidate's resume (JSON) against the analyzed Job Description (JSON).
    Identify:
    1. Missing skills that are mentioned in the JD but absent from the resume.
    2. Weak sections where the content could be more detailed or better aligned.
    3. Specific improvements for each section.
    
    Return the result in a strict JSON format.
    
    EXPECTED OUTPUT:
    {
      "missing_skills": ["Skill A", "Skill B"],
      "weak_sections": ["Experience at X company", "Project Y"],
      "improvements": ["Highlight use of Docker in experience", "Quantify results in summary"]
    }"""
    
    user_content = f"RESUME JSON:\n{json.dumps(resume_json)}\n\nJD ANALYSIS:\n{json.dumps(jd_json)}"
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content}
    ]
    
    response_str = await get_groq_completion(messages, temperature=0.3, max_tokens=1000)
    return json.loads(response_str)

async def optimize_resume(resume_json: Dict[str, Any], jd_json: Dict[str, Any], gap_json: Dict[str, Any]) -> Dict[str, Any]:
    """4. optimize_resume(resume_json, jd_json, gap_json) - Improve sections and align with JD."""
    system_prompt = """You are an elite ATS resume optimizer. Your goal is to rewrite the resume content to perfectly align with the Job Description while addressing the identified gaps.
    
    STRICT RULES:
    1. NEVER hallucinate or invent experience, companies, or projects.
    2. ONLY improve existing content by rephrasing, emphasizing relevant keywords, and using strong action verbs.
    3. Use action verbs like: 'Spearheaded', 'Optimized', 'Orchestrated', 'Architected'.
    4. Bullet points must be concise, punchy, and result-oriented.
    5. Ensure high keyword density for terms found in the JD analysis.
    6. Maintain a clean, professional ATS-friendly structure.
    
    OUTPUT FORMAT (STRICT JSON ONLY):
    {
      "summary": "Improved summary",
      "skills": ["Skill 1", "Skill 2"],
      "experience": [
        {
          "company": "Company Name",
          "role": "Job Title",
          "from": "Start Date",
          "to": "End Date",
          "bullets": ["Enhanced bullet 1", "Enhanced bullet 2"]
        }
      ],
      "projects": [
        {
          "name": "Project Name",
          "tech": "Stack",
          "description": "Improved description"
        }
      ]
    }"""
    
    user_content = f"RESUME JSON:\n{json.dumps(resume_json)}\n\nJD ANALYSIS:\n{json.dumps(jd_json)}\n\nGAPS ANALYSIS:\n{json.dumps(gap_json)}"
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content}
    ]
    
    response_str = await get_groq_completion(messages, temperature=0.3, max_tokens=3000)
    return json.loads(response_str)

async def enhance_resume(resume_text: str, job_description: str, retries: int = 2) -> Dict[str, Any]:
    """Main pipeline function to chain all steps."""
    if not resume_text or not job_description:
        raise HTTPException(status_code=400, detail="Resume text and Job Description are required")
        
    try:
        # Step 1: Analyze Job Description
        jd_analysis = await analyze_jd(job_description)
        
        # Step 2: Parse Resume
        parsed_resume = await parse_resume(resume_text)
        
        # Step 3: Analyze Gap
        gap_analysis = await analyze_gap(parsed_resume, jd_analysis)
        
        # Step 4: Optimize Resume
        optimized_resume = await optimize_resume(parsed_resume, jd_analysis, gap_analysis)
        
        # Validation Layer: Ensure structure is correct
        required_keys = ["summary", "skills", "experience", "projects"]
        for key in required_keys:
            if key not in optimized_resume:
                # Fallback or simple fix if missing
                optimized_resume[key] = parsed_resume.get(key, [] if key != "summary" else "")
                
        return optimized_resume
        
    except (json.JSONDecodeError, ValueError) as e:
        # Automatic retry for invalid JSON
        if retries > 0:
            print(f"Invalid JSON or parsing error, retrying pipeline... ({retries} left)")
            return await enhance_resume(resume_text, job_description, retries - 1)
        raise HTTPException(status_code=500, detail=f"Failed to produce valid JSON output after retries: {str(e)}")
    except Exception as e:
        print(f"Error in enhance_resume pipeline: {str(e)}")
        if isinstance(e, HTTPException):
            raise e
        raise HTTPException(status_code=500, detail=f"Resume enhancement failed: {str(e)}")
