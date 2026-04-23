import json
import os
import httpx
import asyncio
from typing import Dict, Any, List, Optional
from fastapi import HTTPException

# Groq Configuration
GROQ_API_KEY = os.getenv("GROQ_API_KEY")
PRIMARY_MODEL = "llama-3.3-70b-versatile"
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

async def parse_resume_with_layout(resume_text: str) -> Dict[str, Any]:
    """Parses resume text and analyzes layout structure."""
    prompt = f"""
    Analyze the following resume text and extract the content into JSON.
    ALSO identify the original layout structure.
    
    TEXT:
    {resume_text}
    
    JSON format:
    {{
        "content": {{ "summary": "", "skills": [], "experience": [], "projects": [], "education": [] }},
        "layout": {{ 
            "columns": 1 or 2,
            "font_feel": "serif" or "sans-serif",
            "section_order": ["summary", "skills", "experience", etc],
            "alignment": "left" or "center",
            "has_sidebar": true or false
        }}
    }}
    """
    messages = [{"role": "user", "content": prompt}]
    res = await get_groq_completion(messages, temperature=0.1, json_mode=True)
    return json.loads(res)

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

async def optimize_resume_inplace(resume_json: Dict[str, Any], jd_analysis: Dict[str, Any], gap_analysis: Dict[str, Any], layout: Dict[str, Any]) -> Dict[str, Any]:
    """Optimizes content while strictly preserving length and structure."""
    prompt = f"""
    You are an expert editor. Improve the content of this resume to match the Job Description.
    
    CRITICAL CONSTRAINT:
    - PRESERVE the original structure exactly.
    - KEEP the text length similar to the original to avoid layout breaking.
    - DO NOT add new sections.
    - ONLY rewrite the text to be more impactful and keyword-rich.
    
    JOB DESCRIPTION:
    {jd_analysis}
    
    GAPS IDENTIFIED:
    {gap_analysis}
    
    ORIGINAL RESUME:
    {resume_json}
    
    Return the optimized resume JSON.
    """
    messages = [{"role": "user", "content": prompt}]
    res = await get_groq_completion(messages, temperature=0.3, json_mode=True)
    return json.loads(res)

async def structure_user_data(user_input: Dict[str, Any]) -> Dict[str, Any]:
    """2. structure_user_data(user_input) - Convert raw user input into structured JSON for generator."""
    system_prompt = """You are a precise data architect. Convert the user's raw input details into a clean, structured JSON format.
    Do NOT add any information not provided by the user. Simply organize it.
    
    EXPECTED OUTPUT:
    {
      "personal": {"name": "", "email": "", ...},
      "raw_experience": "...",
      "raw_projects": "...",
      "raw_skills": "..."
    }"""
    
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": f"Structure these user details:\n{json.dumps(user_input)}"}
    ]
    
    # Using low temperature for structuring
    response_str = await get_groq_completion(messages, temperature=0.1, max_tokens=1000)
    return json.loads(response_str)

async def generate_resume(user_data: Dict[str, Any], jd_data: Dict[str, Any]) -> Dict[str, Any]:
    """3. generate_resume(user_data, jd_data) - Create final resume JSON."""
    system_prompt = """You are an expert ATS resume writer. Generate a complete, professional resume JSON based on the user's data and the job description.
    
    STRICT RULES:
    1. NEVER hallucinate experience, companies, or projects.
    2. ONLY use the provided user data.
    3. Optimize the tone and keywords based on the Job Description analysis.
    4. Maintain a professional, concise tone.
    
    OUTPUT FORMAT (STRICT JSON ONLY):
    {
      "summary": "2 short sentences",
      "skills": ["Skill1", "Skill2"],
      "experience": [
        {
          "company": "Company Name",
          "role": "Job Title",
          "from": "Start Date",
          "to": "End Date",
          "bullets": ["Action verb + Result-oriented bullet"]
        }
      ],
      "projects": [
        {
          "name": "Project Name",
          "tech": "Stack",
          "description": "Short impactful description"
        }
      ]
    }"""
    
    user_content = f"USER DATA:\n{json.dumps(user_data)}\n\nJD ANALYSIS:\n{json.dumps(jd_data)}"
    messages = [
        {"role": "system", "content": system_prompt},
        {"role": "user", "content": user_content}
    ]
    
    # Feature 2 generate_resume temperature = 0.5
    response_str = await get_groq_completion(messages, temperature=0.5, max_tokens=3000)
    return json.loads(response_str)

async def enhance_resume(resume_text: str, job_description: str, retries: int = 2) -> Dict[str, Any]:
    """Feature 1: Resume Enhancer Pipeline (4-steps)"""
    if not resume_text or not job_description:
        raise HTTPException(status_code=400, detail="Resume text and Job Description are required")
        
    try:
        # Step 1: analyze_jd
        jd_analysis = await analyze_jd(job_description)
        
        # Step 2: parse_resume (and analyze layout)
        parsed_data = await parse_resume_with_layout(resume_text)
        parsed_resume = parsed_data["content"]
        layout_metadata = parsed_data["layout"]
        
        # Step 3: analyze_gap
        gap_analysis = await analyze_gap(parsed_resume, jd_analysis)
        
        # Step 4: optimize_resume (Strictly in-place)
        optimized_resume = await optimize_resume_inplace(parsed_resume, jd_analysis, gap_analysis, layout_metadata)
        
        # Step 5: Match Score Calculation
        match_score = calculate_match_score(parsed_resume, jd_analysis)
        
        # Validation and Insights
        final_resume = validate_resume_json(optimized_resume, parsed_resume)
        
        return {
            "resume": final_resume,
            "original_parsed": parsed_resume,
            "layout_metadata": layout_metadata,
            "match_score": match_score,
            "keywords": {
                "jd_skills": list(jd_analysis.get("skills", [])),
                "matched_skills": list(set([str(s).lower() for s in parsed_resume.get("skills", []) if s]).intersection(set([str(s).lower() for s in jd_analysis.get("skills", []) if s])))
            },
            "insights": {
                "missing_skills": gap_analysis.get("missing_skills", []),
                "weak_sections": gap_analysis.get("weak_sections", []),
                "improvements": gap_analysis.get("improvements", [])
            }
        }
        
    except (json.JSONDecodeError, ValueError) as e:
        if retries > 0:
            return await enhance_resume(resume_text, job_description, retries - 1)
        raise HTTPException(status_code=500, detail="Failed to produce valid JSON output after retries")
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Enhancement failed: {str(e)}")

async def generate_full_resume(user_input: Dict[str, Any], job_description: str, retries: int = 2) -> Dict[str, Any]:
    """Feature 2: Full AI Resume Generator Pipeline (3-steps)"""
    if not user_input or not job_description:
        raise HTTPException(status_code=400, detail="User input and Job Description are required")
        
    try:
        # Step 1: analyze_jd
        jd_analysis = await analyze_jd(job_description)
        
        # Step 2: structure_user_data
        structured_data = await structure_user_data(user_input)
        
        # Step 3: generate_resume
        final_resume = await generate_resume(structured_data, jd_analysis)
        
        # Validation
        return validate_resume_json(final_resume)
        
    except (json.JSONDecodeError, ValueError) as e:
        if retries > 0:
            return await generate_full_resume(user_input, job_description, retries - 1)
        raise HTTPException(status_code=500, detail="Failed to generate valid resume JSON after retries")
    except Exception as e:
        if isinstance(e, HTTPException): raise e
        raise HTTPException(status_code=500, detail=f"Generation failed: {str(e)}")

def validate_resume_json(resume_json: Dict[str, Any], fallback: Optional[Dict[str, Any]] = None) -> Dict[str, Any]:
    """Validation layer to ensure strict JSON structure."""
    required_keys = ["summary", "skills", "experience", "projects"]
    for key in required_keys:
        if key not in resume_json:
            if fallback and key in fallback:
                resume_json[key] = fallback[key]
            else:
                resume_json[key] = [] if key != "summary" else ""
    return resume_json

def calculate_match_score(resume_json: Dict[str, Any], jd_analysis: Dict[str, Any]) -> int:
    """Simple algorithm to calculate match score (0-100)."""
    try:
        resume_skills = set([str(s).lower() for s in resume_json.get("skills", []) if s])
        jd_skills = set([str(s).lower() for s in jd_analysis.get("skills", []) if s])
        
        if not jd_skills: return 70 # Default if JD has no skills
        
        match_count = len(resume_skills.intersection(jd_skills))
        score = int((match_count / len(jd_skills)) * 100)
        
        # Add base score for having content
        score = min(95, score + 20) 
        return max(30, score)
    except:
        return 50
