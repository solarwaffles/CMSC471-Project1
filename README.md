# College Access Explorer

Interactive D3 dashboard for CMSC471 Project 1.

- Open `index.html` directly for the complete, self-contained dashboard.
- Editable source and bundled datasets are in `dist/`. Run `python3 -m http.server 8000 --directory dist` to develop locally.
- Publish GitHub Pages from `main`, root folder, in repository Settings → Pages.
- The scatterplot brush filters the home-state map, race bars, income donut, and college table.
- The map defaults to selected-college entrants from each home state divided by its 2014 total resident population. This measures enrollment intensity, not an applicant acceptance rate.
- Complete the webpage's team/process write-up with your actual contributions and people-hours before submitting.
- Sources and methods appear on the webpage.

## Original assignment notes

Project Description: https://zcliu.github.io/teaching/CMSC471/assignments/A1-interactive.html
Data Link: https://opportunityinsights.org/paper/collegeadmissions/

Required elements
1. Web-based Interactive visualization
The goal is not to create an overwhelming visualization but a focused, elegant, and intuitive design. You will implement at least one interaction from each category:

Category I: Connection/Filtering

Brushing and linking
Dynamic filters or queries (Link by tuple/query)
Category II: Exploration/Selection/Abstraction/Elaboration/Encoding

Panning and/or zooming.
Details-on-demand (e.g., tooltips).
Highlighting, annotation.
Other narrative features intended to draw attention to particular items of interest and provide additional context.
We expect most students will use D3.js for this assignment; however, you are free to use other web-based libraries (e.g., Vega, Plotly, Shinny, etc). Your program should not require customized server-side support; you should simply load data from a static data file (csv, json, etc.).

2. Write-ups on your webpage
Include a brief, clear write-up on your webpage:

A brief introduction to your dataset, background and your chosen variable(s) or subset.

Rationale for your design decisions. List your implemented interactions. Explain: How did you choose your particular visual encodings and interaction techniques? What alternatives did you consider and how did you arrive at your ultimate choices?

References to data resources. Be sure to list the data source you used. If your work adapts or builds on existing visualization examples, please cite those as well.

An overview of your development process. Describe how the work was split among the team members. Include a commentary on the development process, including answers to the following questions: Roughly how much time did you spend developing your application (in people-hours)? What aspects took the most time?

If any: A brief summary of AI (e.g. ChatGPT, Cursor, Codex) usage.

3. Public webpage
Deploy your visualization on a publicly accessible webpage. There are several ways to do this—the easiest is to use GitHub to host your project repository (see https://pages.github.com/). See the Publishing your site section at the end of this handout for a step-by-step guide.

4. Record a demo video
The main purpose of this video is to provide a timestamp for your project demo (to prevent major changes after the deadline). It doesn’t need to be polished or have a professional voiceover, but it should be short (a few minutes), functional, and clearly showcase the features you’ve implemented. A casual voiceover is encouraged but not required.

Checklist
 - [x] Register your team on Canvas (use A1 groups).
 - [ ] Design an interactive visualization (could multiple smaller visualizations) with required interaction techniques.
 - [x] Deploy your visualization on as a webpage.
 - [ ] Make sure your visualization has labels and captions.
 - [x] Include a brief write-up with references on your webpage.
 - [ ] Submit your webpage URL to Canvas-ELMS.
 - [ ] Submit a short demo video to Canvas-ELMS.

