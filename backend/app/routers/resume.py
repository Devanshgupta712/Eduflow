import json
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import or_, desc
import httpx
import os

from app.database import get_db
from app.routers.auth import get_current_user
from app.models.user import User
from app.models.resume import Resume
from pydantic import BaseModel

router = APIRouter(prefix="/api/resume", tags=["Resume"])

class ResumeSummaryResponse(BaseModel):
    id: str
    title: str
    mode: str
    template: str
    is_primary: bool
    updated_at: str

class ResumeCreateRequest(BaseModel):
    title: str = "My New Resume"
    mode: str = "visual"
    template: str = "modern"

class ResumeUpdateRequest(BaseModel):
    title: Optional[str] = None
    template: Optional[str] = None
    is_primary: Optional[bool] = None
    personal: Optional[str] = None
    summary: Optional[str] = None
    skills: Optional[str] = None
    experience: Optional[str] = None
    education: Optional[str] = None
    projects: Optional[str] = None
    certifications: Optional[str] = None
    languages: Optional[str] = None
    original_resume_text: Optional[str] = None
    job_description: Optional[str] = None

class AIEnhanceRequest(BaseModel):
    resume_text: str
    job_description: str

class AIGenerateRequest(BaseModel):
    basic_details: Dict[str, Any]
    job_description: str
    
class AISectionRewriteRequest(BaseModel):
    section_name: str
    section_content: str
    job_description: Optional[str] = None

GROQ_API_KEY = os.getenv("GROQ_API_KEY")

async def get_groq_completion(prompt: str, system_prompt: str = "You are an expert ATS resume writer.") -> str:
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="Groq API Key not configured")
        
    async with httpx.AsyncClient() as client:
        try:
            response = await client.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [
                        {"role": "system", "content": system_prompt},
                        {"role": "user", "content": prompt}
                    ],
                    "temperature": 0.7,
                    "max_tokens": 4000
                },
                timeout=60.0
            )
            if response.status_code != 200:
                error_detail = response.text
                try:
                    error_json = response.json()
                    error_detail = error_json.get("error", {}).get("message", response.text)
                except:
                    pass
                raise HTTPException(status_code=500, detail=f"Groq API Error: {error_detail}")
                
            data = response.json()
            return data["choices"][0]["message"]["content"]
        except Exception as e:
            if isinstance(e, HTTPException):
                raise e
            raise HTTPException(status_code=500, detail=f"LLM Generation failed: {str(e)}")


@router.get("", response_model=List[ResumeSummaryResponse])
async def list_resumes(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Resume)
        .where(Resume.student_id == current_user.id)
        .order_by(desc(Resume.updated_at))
    )
    resumes = result.scalars().all()
    
    return [
        ResumeSummaryResponse(
            id=r.id,
            title=r.title,
            mode=r.mode,
            template=r.template,
            is_primary=r.is_primary,
            updated_at=r.updated_at.isoformat()
        )
        for r in resumes
    ]

@router.post("", response_model=dict)
async def create_resume(
    req: ResumeCreateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Auto-fill personal data
    personal_data = {
        "name": current_user.name,
        "email": current_user.email,
        "phone": current_user.phone or "",
        "linkedin": "",
        "github": "",
        "location": ""
    }
    
    # Auto-fill education if available
    education_data = []
    if current_user.degree or current_user.highest_education:
        education_data.append({
            "degree": current_user.degree or current_user.highest_education,
            "school": "",
            "year": current_user.passing_year or "",
            "grade": ""
        })

    new_resume = Resume(
        student_id=current_user.id,
        title=req.title,
        mode=req.mode,
        template=req.template,
        personal=json.dumps(personal_data),
        education=json.dumps(education_data)
    )
    db.add(new_resume)
    await db.commit()
    await db.refresh(new_resume)
    
    return {"id": new_resume.id, "message": "Resume created successfully"}

@router.get("/{resume_id}", response_model=dict)
async def get_resume(
    resume_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Resume).where(Resume.id == resume_id, Resume.student_id == current_user.id))
    resume = result.scalars().first()
    
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
        
    return {
        "id": resume.id,
        "title": resume.title,
        "mode": resume.mode,
        "template": resume.template,
        "is_primary": resume.is_primary,
        "personal": json.loads(resume.personal),
        "summary": resume.summary,
        "skills": json.loads(resume.skills),
        "experience": json.loads(resume.experience),
        "education": json.loads(resume.education),
        "projects": json.loads(resume.projects),
        "certifications": json.loads(resume.certifications),
        "languages": json.loads(resume.languages),
        "original_resume_text": resume.original_resume_text,
        "job_description": resume.job_description,
        "updated_at": resume.updated_at.isoformat()
    }

@router.put("/{resume_id}", response_model=dict)
async def update_resume(
    resume_id: str,
    req: ResumeUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Resume).where(Resume.id == resume_id, Resume.student_id == current_user.id))
    resume = result.scalars().first()
    
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
        
    # Update fields if provided
    if req.title is not None: resume.title = req.title
    if req.template is not None: resume.template = req.template
    if req.is_primary is not None: resume.is_primary = req.is_primary
    if req.personal is not None: resume.personal = req.personal
    if req.summary is not None: resume.summary = req.summary
    if req.skills is not None: resume.skills = req.skills
    if req.experience is not None: resume.experience = req.experience
    if req.education is not None: resume.education = req.education
    if req.projects is not None: resume.projects = req.projects
    if req.certifications is not None: resume.certifications = req.certifications
    if req.languages is not None: resume.languages = req.languages
    if req.original_resume_text is not None: resume.original_resume_text = req.original_resume_text
    if req.job_description is not None: resume.job_description = req.job_description
    
    # If this is being set as primary, unset others for this user
    if req.is_primary:
        # TODO: A bulk update would be better here
        pass

    await db.commit()
    return {"status": "success"}

@router.delete("/{resume_id}", response_model=dict)
async def delete_resume(
    resume_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Resume).where(Resume.id == resume_id, Resume.student_id == current_user.id))
    resume = result.scalars().first()
    
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")
        
    await db.delete(resume)
    await db.commit()
    return {"status": "success"}

@router.post("/{resume_id}/set-primary", response_model=dict)
async def set_primary_resume(
    resume_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Get all resumes
    result = await db.execute(select(Resume).where(Resume.student_id == current_user.id))
    resumes = result.scalars().all()
    
    target_found = False
    for r in resumes:
        if r.id == resume_id:
            r.is_primary = True
            target_found = True
        else:
            r.is_primary = False
            
    if not target_found:
        raise HTTPException(status_code=404, detail="Resume not found")
        
    await db.commit()
    return {"status": "success"}

# --- AI ENDPOINTS ---

@router.post("/enhance", response_model=dict)
async def ai_enhance_resume(
    req: AIEnhanceRequest,
    current_user: User = Depends(get_current_user)
):
    system_prompt = """You are an expert ATS resume writer.
Your objective is to take the user's existing resume text and a target Job Description, and output a clean, professional JSON resume structure.

STRICT RULES:
1. SUMMARY: Keep it extremely concise (MAX 2 SHORT SENTENCES). Focus on current role and top tech.
2. EXPERIENCE: DO NOT hallucinate experience they do not have. If no experience is found in the input, return an empty array [].
3. PROJECTS: Only include projects found in the input.
4. TONE: Professional and factual. Avoid excessive buzzwords.

You MUST respond with pure JSON only:
{
  "summary": "Max 2 short sentences",
  "skills": ["Skill1", "Skill2"],
  "experience": [{"company": "Name", "role": "Title", "from": "Date", "to": "Date", "bullets": ["Action verb + result + tech"]}],
  "education": [{"degree": "Name", "school": "Name", "year": "Year", "grade": ""}],
  "projects": [{"name": "Name", "tech": "Stack", "description": "1 sentence", "link": ""}]
}
Return only raw JSON."""

    prompt = f"RESUME TEXT:\n{req.resume_text}\n\nTARGET JOB DESCRIPTION:\n{req.job_description}"
    
    generated_json_str = await get_groq_completion(prompt, system_prompt)
    
    try:
        # Strip markdown if model added them despite instructions
        clean_json = generated_json_str.strip()
        if clean_json.startswith("```json"):
            clean_json = clean_json[7:-3]
        elif clean_json.startswith("```"):
            clean_json = clean_json[3:-3]
            
        parsed = json.loads(clean_json)
        return {"data": parsed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response into JSON: {str(e)}")

@router.post("/generate", response_model=dict)
async def ai_generate_resume(
    req: AIGenerateRequest,
    current_user: User = Depends(get_current_user)
):
    system_prompt = """You are an expert ATS resume writer.
Generate a professional resume JSON based ON THE DETAILS PROVIDED.

STRICT RULES:
1. SUMMARY: Max 2 SHORT sentences. 
2. NO HALLUCINATION: Do not invent jobs, companies, or projects that aren't in the raw details.
3. If a section is missing from raw details, return it as an empty array [].
4. ATS OPTIMIZED: Use keywords from the JD, but only if they match the user's actual background.

You MUST respond with pure JSON only:
{
  "summary": "2 short sentences",
  "skills": ["Skill1", "Skill2"],
  "experience": [{"company": "Name", "role": "Title", "from": "Date", "to": "Date", "bullets": ["Action verb + impact"]}],
  "education": [{"degree": "Name", "school": "Name", "year": "Year", "grade": ""}],
  "projects": [{"name": "Name", "tech": "Stack", "description": "Description", "link": ""}]
}
Return only raw JSON."""

    prompt = f"USER RAW DETAILS:\n{json.dumps(req.basic_details, indent=2)}\n\nTARGET JOB DESCRIPTION:\n{req.job_description}"
    
    generated_json_str = await get_groq_completion(prompt, system_prompt)
    
    try:
        clean_json = generated_json_str.strip()
        if clean_json.startswith("```json"):
            clean_json = clean_json[7:-3]
        elif clean_json.startswith("```"):
            clean_json = clean_json[3:-3]
            
        parsed = json.loads(clean_json)
        return {"data": parsed}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to parse AI response into JSON: {str(e)}")

import io
from fastapi import UploadFile, File

@router.post("/extract-text")
async def extract_resume_text(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user)
):
    """Extracts text from uploaded PDF or Word document for Mode 2"""
    content = await file.read()
    filename = file.filename.lower()
    text = ""
    
    try:
        if filename.endswith(".pdf"):
            import pdfplumber
            with pdfplumber.open(io.BytesIO(content)) as pdf:
                for page in pdf.pages:
                    extracted = page.extract_text()
                    if extracted:
                        text += extracted + "\n"
        elif filename.endswith(".docx"):
            import docx
            doc = docx.Document(io.BytesIO(content))
            for para in doc.paragraphs:
                text += para.text + "\n"
        else:
            raise HTTPException(status_code=400, detail="Unsupported file format. Please upload a PDF or DOCX file.")
            
        return {"text": text.strip()}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to extract text: {str(e)}")

@router.post("/{resume_id}/ai-rewrite-section", response_model=dict)
async def ai_rewrite_section(
    resume_id: str,
    req: AISectionRewriteRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify owner
    result = await db.execute(select(Resume).where(Resume.id == resume_id, Resume.student_id == current_user.id))
    if not result.scalars().first():
        raise HTTPException(status_code=404, detail="Resume not found")

    system_prompt = f"You are an expert resume writer. Improve the following {req.section_name} section to be more professional, action-oriented, and impactful."
    if req.job_description:
        system_prompt += f" Ensure it uses keywords relevant to this job description: {req.job_description[:500]}..."
        
    system_prompt += "\nReturn ONLY the improved text, nothing else."

    prompt = f"Current {req.section_name}:\n{req.section_content}"
    
    improved_content = await get_groq_completion(prompt, system_prompt)
    return {"content": improved_content.strip()}

from fastapi.responses import StreamingResponse
from jinja2 import Environment, FileSystemLoader

@router.get("/{resume_id}/export")
async def export_resume_pdf(
    resume_id: str,
    template: str = "modern",
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # Verify owner
    result = await db.execute(select(Resume).where(Resume.id == resume_id, Resume.student_id == current_user.id))
    resume = result.scalars().first()
    if not resume:
        raise HTTPException(status_code=404, detail="Resume not found")

    # Only importing weasyprint when PDF is generated to save memory on server startup
    try:
        from weasyprint import HTML
    except ImportError:
        raise HTTPException(status_code=500, detail="PDF generation library missing. Please make sure weasyprint is installed.")

    # Prepare data for Jinja template
    context = {
        "title": resume.title,
        "personal": json.loads(resume.personal) if resume.personal else {},
        "summary": resume.summary or "",
        "skills": json.loads(resume.skills) if resume.skills else [],
        "experience": json.loads(resume.experience) if resume.experience else [],
        "education": json.loads(resume.education) if resume.education else [],
        "projects": json.loads(resume.projects) if resume.projects else [],
        "certifications": json.loads(resume.certifications) if resume.certifications else [],
        "languages": json.loads(resume.languages) if resume.languages else []
    }

    # Setup Jinja environment
    template_dir = os.path.join(os.path.dirname(__file__), "..", "templates")
    # Verify template exists, fallback to modern
    template_name = f"resume_{template}.html"
    if not os.path.exists(os.path.join(template_dir, template_name)):
        template_name = "resume_modern.html"

    jinja_env = Environment(loader=FileSystemLoader(template_dir))
    
    try:
        jinja_template = jinja_env.get_template(template_name)
        html_out = jinja_template.render(context)
        
        # Convert HTML to PDF using weasyprint
        pdf_bytes = HTML(string=html_out).write_pdf()
        
        # Stream the PDF back to the user
        return StreamingResponse(
            io.BytesIO(pdf_bytes), 
            media_type="application/pdf",
            headers={"Content-Disposition": f"attachment; filename=resume_{resume.title.replace(' ', '_')}.pdf"}
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Error generating PDF: {str(e)}")
