from typing import List
from pydantic import BaseModel, Field


class WebSearchItem(BaseModel):
    """
    Represents a single web search item with its summary and URLs.
    """
    reason: str = Field(
        description="Your reasoning for why this search is important to the query."
    )
    query: str = Field(
        description="he search term to use for the web search."
    )
    

class WebSearchPlan(BaseModel):
    """
    Represents a web search plan with a list of WebSearchItems.
    """
    searches: List[WebSearchItem] = Field(
        description="A list of web searches to perform to best answer the query."
    )


class ReportData(BaseModel):
    short_summary: str = Field(description="A short 2-3 sentence summary of the findings.")
    markdown_report: str = Field(description="The final report")
    follow_up_questions: list[str] = Field(description="Suggested topics to research further")