from backend.tools.email_tools import send_email_tool
from backend.templates.prompts import get_email_tool_instructions, get_subject_agent_instructions, get_scope_agent_instructions
from backend.structures.structure import ReportData
from backend.templates.prompts import get_writer_agent_instructions
from backend.structures.structure import WebSearchPlan
from backend.templates.prompts import get_planner_agent_instructions
from backend.templates.prompts import get_search_agent_instructors
from backend.tools.search_tools import tavily_search
from agents import Agent, Runner
import os
import json
from dotenv import load_dotenv

load_dotenv(override=True)

model_name = os.getenv("MODEL_NAME", "gpt-5.4-mini")
how_many_searches = int(os.getenv("HOW_MANY_SEARCHES", 2))



search_agent = Agent(name="Search Agent", instructions=get_search_agent_instructors(), tools=[tavily_search], model=model_name)


planner_agent = Agent(name="Planner Agent", instructions=get_planner_agent_instructions(how_many_searches), model=model_name, output_type=WebSearchPlan)


writer_agent = Agent(name="Writer Agent", instructions=get_writer_agent_instructions(), model=model_name, output_type=ReportData)

email_agent = Agent(name="Email Agent", instructions=get_email_tool_instructions(), tools=[send_email_tool], model=model_name)
subject_agent = Agent(name="Subject Agent", instructions=get_subject_agent_instructions(), model=model_name, output_type=str)
scope_agent = Agent(name="Scope Agent", instructions=get_scope_agent_instructions(), model=model_name, output_type=str)

async def run_research_workflow_stream(query: str):
    """
    Run the complete research workflow: Planner -> Search -> Writer -> Email
    Yields NDJSON strings for each progress update.
    """
    yield json.dumps({"status": "planning", "message": "Evaluating research scope..."}) + "\n"
    
    scope_result = await Runner.run(scope_agent, query)
    scope_output = str(scope_result.final_output).strip()
    
    if "VALID_RESEARCH_TOPIC" not in scope_output:
        yield json.dumps({
            "status": "chat", 
            "message": scope_output
        }) + "\n"
        return

    yield json.dumps({"status": "planning", "message": "Planning searches..."}) + "\n"
    
    # 1. Plan the searches
    planner_result = await Runner.run(planner_agent, query)
    plan: WebSearchPlan = planner_result.final_output_as(WebSearchPlan)

    yield json.dumps({"status": "searching", "message": f"Executing {len(plan.searches)} searches..."}) + "\n"
    
    # 2. Execute the searches
    search_results = []
    for i, search_item in enumerate(plan.searches):
        yield json.dumps({"status": "searching", "message": f"Search {i+1}/{len(plan.searches)}: {search_item.query}"}) + "\n"
        search_res = await Runner.run(search_agent, search_item.query)
        search_results.append(str(search_res.final_output))
        
    yield json.dumps({"status": "writing", "message": "Writing final report..."}) + "\n"
    
    # 3. Write the report
    writer_input = f"Original Query: {query}\n\nSearch Results:\n" + "\n\n".join(search_results)
    writer_result = await Runner.run(writer_agent, writer_input)
    report: ReportData = writer_result.final_output_as(ReportData)
    
    yield json.dumps({"status": "emailing", "message": "Generating email subject and sending email..."}) + "\n"
    
    # 4. Send the email with the generated report
    subject_input = f"Report summary: {report.short_summary}\n\nReport body: {report.markdown_report}"
    subject_result = await Runner.run(subject_agent, subject_input)
    email_subject = str(subject_result.final_output).strip().strip('"').strip("'")
    
    email_text = report.short_summary
    email_html = f"<h1>{email_subject}</h1><p>{report.short_summary}</p><div>{report.markdown_report}</div>"
    
    email_input = f"Send this report as an email.\nSubject: {email_subject}\nText Body: {email_text}\nHTML Body: {email_html}"
    await Runner.run(email_agent, email_input)
    
    yield json.dumps({
        "status": "complete", 
        "message": "Workflow complete.",
        "result": {
            "short_summary": report.short_summary,
            "markdown_report": report.markdown_report,
            "follow_up_questions": report.follow_up_questions
        }
    }) + "\n"