from fastapi import FastAPI, HTTPException
from pydantic import BaseModel
from typing import List
import uvicorn

from fastapi.responses import StreamingResponse
from fastapi.middleware.cors import CORSMiddleware

from backend.agents.deep_research import run_research_workflow_stream
from backend.structures.structure import ReportData

app = FastAPI(title="Deep Research API", description="API to run the AI agents for deep research")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

class ResearchRequest(BaseModel):
    query: str

class ResearchResponse(BaseModel):
    short_summary: str
    markdown_report: str
    follow_up_questions: List[str]

@app.post("/research")
async def do_research(request: ResearchRequest):
    return StreamingResponse(run_research_workflow_stream(request.query), media_type="application/x-ndjson")

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
