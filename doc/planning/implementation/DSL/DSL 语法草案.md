
```
workflow "Research Agent": // workflow [Agent Name]
{
	variable:
	{
		string user-managed research_topic;
		string shared research_date = "2026-10-19"
		number agent-managed paper_number = 5;
	}
	
	block:
	{
		agent_action research:
		{
			model "gpt-5";
		    goal "Research ${research_topic} and produce a structured brief.";
		    knowledge [product_docs];
		    toolbox [tools list];
		}
		
		task publish:
		{
			save_report using system_tool "file.write":
			{
			    path = "reports/${research_topic}.md";
			    content = research.output;
			}
		}
	}
	
	edge:
	{
		start -> research;
	}
}
```
