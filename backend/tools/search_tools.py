import os
import requests
from dotenv import load_dotenv
from agents import function_tool

load_dotenv()

@function_tool
def tavily_search(query: str) -> str:
    """
    Search the web for a given query using the Tavily API.
    
    Args:
        query: The search query string.
        
    Returns:
        A string containing the search results and a summary of the findings.
    """
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return "Error: TAVILY_API_KEY environment variable not set."
        
    url = "https://api.tavily.com/search"
    payload = {
        "api_key": api_key,
        "query": query,
        "search_depth": "basic",
        "include_answer": True
    }
    
    try:
        response = requests.post(url, json=payload)
        response.raise_for_status()
        data = response.json()
        
        answer = data.get("answer", "")
        results = data.get("results", [])
        
        output = ""
        if answer:
            output += f"Summary: {answer}\n\n"
            
        output += "Sources:\n"
        for result in results:
            output += f"- {result.get('title')}: {result.get('url')}\n  {result.get('content')}\n\n"
            
        return output
    except Exception as e:
        return f"Error performing search: {str(e)}"
