# MASTER BUILD PROMPT — THE UNDERSTUDY
## A Demonstration-to-Automation Agent | 3-Hour Hackathon MVP

You are a senior full-stack engineer, AI engineer, product designer, and hackathon technical lead. Your job is to **build a working, polished, demonstrable product directly in the current workspace** called **The Understudy**.

You must create and run the application, install necessary dependencies, test the core flow, fix errors, and leave the project ready to demo. Do not just give me code snippets, instructions, or a plan. Inspect the workspace first, then implement the product.

You have a strict deadline: **10:00 AM–1:00 PM (3 hours)**. Prioritize a complete, reliable, visually impressive end-to-end experience over excessive features.

---

# 1. PRODUCT VISION

**The Understudy lets people teach an AI a repetitive computer task by demonstrating it once. The AI converts that demonstration into a reusable, editable workflow, asks for approval, executes the task, verifies the result, and recovers from simple interface changes when possible.**

Core pitch:

> Show it once. It learns the workflow. Approve it. It does it for you.

The product should feel like an AI workflow apprentice, not just another chatbot or macro recorder.

Its defining capabilities are:

1. **Teach:** Capture a demonstration or guide the user through teaching a workflow.
2. **Understand:** Compile the task into an editable, structured Skill Card.
3. **Approve:** Let the user inspect the workflow before execution.
4. **Act:** Execute the approved workflow visibly in a browser.
5. **Adapt:** Attempt safe recovery when an expected interface element changes.
6. **Verify:** Confirm the task succeeded using observable evidence.
7. **Undo:** Restore the previous state for supported sandbox operations.

The product must clearly distinguish implemented capabilities from fallbacks. Never pretend an action, AI call, recording, verification, recovery, or undo succeeded when it did not.

# 2. THE DEMO SCENARIO

Build one polished, deterministic scenario that demonstrates the full product.

Create two local sandbox pages:

### App A: AttendanceTracker

A fictional attendance dashboard with approximately 8–12 students, each marked Present or Absent.

Include:
- A simple table of fictional students.
- Attendance status indicators.
- A clear page title and useful visual hierarchy.
- A stable way for the automation runner to read the table.

### App B: DailyReport

A fictional daily reporting form with:
- A field for the total number of present students.
- A text field for a report note.
- A Submit button.
- A visible confirmation state after submission.
- A way to inspect the saved report.

### The demonstrated workflow

The user teaches The Understudy to:

1. Open AttendanceTracker.
2. Inspect the attendance records.
3. Calculate the number of present students.
4. Open DailyReport.
5. Enter the calculated count.
6. Enter a concise note summarizing attendance.
7. Pause before final submission.
8. Ask the user to approve submission.
9. Submit the report after approval.
10. Verify the saved report and display a before/after summary.

The attendance count must be calculated from actual sandbox data, not hardcoded into the runner.

Provide a Reset Demo button so the entire demonstration can be repeated reliably.

# 3. TECHNOLOGY AND IMPLEMENTATION

First inspect the existing project. Preserve useful existing code rather than replacing the project blindly.

For a new project, prefer:

- Frontend: React + TypeScript + Vite.
- Styling: Tailwind CSS if quick to configure, otherwise clean custom CSS.
- Browser automation: Playwright.
- AI workflow compilation: Official OpenAI SDK using a server-side API key.
- Backend: A lightweight Node.js server compatible with the chosen setup.
- Validation: Zod or an equivalent schema validator.
- Storage: In-memory or local JSON persistence if sufficient for this demo.

Keep the architecture simple. Do not introduce unnecessary infrastructure, containers, cloud deployment, authentication, or complex databases.

The application should run locally with a clear README and a small number of startup commands.

Use environment variables:
- `OPENAI_API_KEY`
- `OPENAI_MODEL`

Never expose the API key in frontend code, client-side bundles, browser storage, logs, or committed files. Add an `.env.example` and ensure `.env` is ignored by Git.

If the API is unavailable, provide a clearly labelled deterministic fallback compiler so the demo can still run. Never represent fallback output as a real LLM-generated result.

Do not spend valuable time fighting complex integrations. If a technical choice blocks the working demo, simplify it and document the trade-off.

# 4. THE PRODUCT EXPERIENCE

Create a premium desktop-first dashboard called **The Understudy**.

It should look like a real early-stage AI product, not a generic admin template.

### Visual direction

- Dark charcoal or near-black application shell.
- Warm white text and readable secondary text.
- Restrained electric-lime accent color.
- Fine borders, balanced spacing, subtle depth, and clean typography.
- Strong visual hierarchy and carefully designed empty, loading, running, success, and error states.
- Smooth but restrained transitions.
- Responsive layout that works on a laptop screen.
- No excessive gradients, decorative clutter, giant headings, or unnecessary animations.

Use lucide-react icons if already available or quick to install.

### Suggested layout

**Sidebar**
- The Understudy logo and name.
- Overview.
- My Skills.
- Run History.
- Settings or Demo Environment.

**Main workspace**
- A clear heading: “Your workflows, handled.”
- A short description explaining that demonstrated tasks become reusable skills.
- A prominent “Teach a new skill” action.
- A featured saved skill card: “Generate Daily Attendance Report.”
- Recent activity and the latest execution status.

**Skill detail view**
- Skill title and purpose.
- Workflow steps.
- Input parameters.
- Allowed sandbox pages.
- Confidence or validation status.
- Buttons for Edit, Dry Run, and Approve & Run.

**Execution view**
- Live action timeline.
- Current step.
- Browser status.
- Pause and Stop controls.
- Verification status.
- Before/after comparison.
- Undo control when a supported reversible action has occurred.

Make the entire experience coherent. Prioritize a small number of polished screens over many shallow ones.

# 5. TEACH MODE

Build a Teach Mode that allows the user to define a task.

Preferred approach:
- Open the sandbox in a visible browser controlled by Playwright.
- Capture relevant navigation, clicks, input actions, and the target elements involved.
- Preserve meaningful labels, accessible roles, URLs, and element context.
- Convert the recorded or guided actions into a workflow specification.

However, **do not let full browser-event recording jeopardize the deadline**.

If reliable recording across both pages is too time-consuming, implement a clearly labelled Guided Teach Mode. The user should be able to describe the task and walk through a short guided setup that produces the same workflow specification.

Do not create a fake recorder that merely animates a recording indicator. If the implementation is guided teaching rather than full event capture, label it honestly.

The user must be able to see what the system learned.

# 6. AI WORKFLOW COMPILER

When the user completes teaching, convert the task into a structured Skill Card.

Use the OpenAI API for the actual workflow-compilation step when a valid API key is configured.

Require schema-constrained structured output where supported, and validate the result before showing it to the user.

Suggested Skill Card structure:

- `id`
- `title`
- `description`
- `trigger`
- `allowedDomains`
- `parameters`
- `steps`
- `successCheck`
- `requiresApproval`
- `createdAt`

Each workflow step should include appropriate fields such as:
- `instruction`
- `actionType`
- `target`
- `selector` or accessible locator
- `fallbackDescription`
- `confidence`
- `requiresConfirmation`

The compiler must not invent arbitrary URLs, actions, or credentials. It must stay within the allowed sandbox pages and the actions supported by the runner.

If confidence is low or an action is ambiguous, flag it for user review rather than guessing silently.

### Editable Skill Card

Display the compiled workflow in a readable, editable format.

Allow the user to:
- Edit the skill title.
- Review and edit workflow steps.
- Inspect the parameters.
- See which actions require approval.
- Dry-run the workflow where practical.
- Approve the skill before execution.

The card should explain the task in plain English. Users should not need to read raw JSON to understand what the AI intends to do.

# 7. EXECUTION ENGINE

Use Playwright to run the approved workflow against the local sandbox.

The runner must perform actual browser interactions rather than simulating progress with timers.

It should:
- Open the correct sandbox page.
- Inspect real attendance data.
- Calculate the present-student count.
- Navigate to the report form.
- Fill the correct values.
- Display a timestamped or ordered action timeline.
- Pause before the final submission.
- Resume only after the user explicitly approves.
- Verify the resulting saved report.
- Display a meaningful result summary.

Build a persistent-looking execution panel with working Pause and Stop controls. If a fully interruptible execution loop is too costly, implement the safest reliable control mechanism available and clearly reflect its actual state.

Do not report success merely because the last action was attempted. Check the observable postcondition.

### Human approval

On the first run, always pause before submitting the report.

Show a confirmation panel such as:

“Ready to submit: 9 students present. Review the report and approve this action.”

The count must come from the actual attendance table.

Only proceed after the user clicks the approval action.

# 8. SELF-HEALING DEMONSTRATION

This is the key differentiator. Implement one real, controlled recovery scenario rather than pretending to support every website.

### Scenario

The workflow initially expects a button labelled **Submit**.

During the demo, the label changes to **Send Report**.

The runner should:

1. Attempt to locate the original target using the recorded or compiled locator.
2. Detect that the expected target cannot be found.
3. Inspect the current sandbox page and available accessible elements.
4. Identify a plausible replacement only when the evidence is sufficiently strong.
5. Retry the action using the replacement locator.
6. Log the repair in the execution timeline.
7. Continue to verification.

Example timeline:

- Read attendance records.
- Calculated present count.
- Opened DailyReport.
- Filled report fields.
- Original target “Submit” was not found.
- Recovered target: “Send Report”.
- Waiting for user approval.
- Submitted report.
- Verified saved report.

### Integrity requirements

Do not silently hardcode the replacement into the original skill.

Do not inspect for the replacement label first and then falsely claim the original action failed.

Do not display “Self-healing successful” unless the original locator genuinely fails and the recovery path actually succeeds.

Use a controlled demo toggle to rename the button at the right moment. The user should be able to trigger this scenario deliberately.

If recovery is ambiguous, stop and ask the user instead of clicking a potentially destructive element.

# 9. VERIFICATION, DIFF, AND UNDO

### Verification

After submission, check the saved report or success state and compare its values against the intended inputs.

Display:
- Expected present count.
- Actual saved count.
- Report note.
- Verification outcome.

Use evidence from the application rather than an assumed success flag.

### Before/after diff

Capture the relevant sandbox state before and after execution.

Display a clear comparison, for example:

- Present count: empty → 9.
- Report note: empty → “Attendance recorded for today.”
- Submission status: Draft → Submitted.

The numbers and statuses must reflect the actual sandbox state.

### Undo

Implement a real undo for this controlled sandbox.

Before execution, snapshot the report fields and submission status. Provide an Undo action that restores the prior state.

After undo, verify that the restored values match the snapshot.

Explain through the UI that undo applies to this supported sandbox operation. Do not claim universal rollback for arbitrary websites or external actions.

# 10. RUN HISTORY AND DEMO CONTROLS

Keep a lightweight activity history showing:
- Skill name.
- Run status.
- Date/time.
- Verification result.
- Recovery event, if any.

Include:
- Reset Demo.
- Trigger Interface Change.
- Run Skill.
- Undo Last Run, when available.

Make these controls functional. A reset should return the sandbox to a known state so the demo can be repeated without manually editing data.

# 11. THREE-HOUR EXECUTION SCHEDULE

Follow these priorities in order. Do not spend the first hour perfecting the UI.

### 10:00–10:20 — Working sandbox
- Inspect workspace.
- Set up or repair the application.
- Build AttendanceTracker and DailyReport.
- Ensure actual data reading, form submission, and reset work.

### 10:20–10:50 — Teach and dashboard
- Build the dashboard and skill detail view.
- Implement teaching or clearly labelled guided teaching.
- Ensure a workflow can be created and reviewed.

### 10:50–11:20 — AI compilation
- Connect the server-side OpenAI SDK.
- Compile tasks into validated Skill Cards.
- Add an honest fallback if the API is unavailable.
- Make the card editable.

### 11:20–12:00 — Execution
- Implement Playwright execution.
- Read the real attendance table.
- Calculate the count.
- Fill the report.
- Pause before submission for approval.
- Verify the saved report.

### 12:00–12:30 — Recovery and reversibility
- Implement the renamed-button recovery scenario.
- Add action timeline and verification evidence.
- Implement before/after diff and sandbox undo.
- If necessary, prioritize reliable recovery and undo over decorative extras.

### 12:30–1:00 — Testing and presentation
- Fix all critical errors.
- Reset the sandbox and run the complete demo repeatedly.
- Verify the approval gate, renamed-button scenario, verification, and undo.
- Write concise setup instructions.
- Prepare a 60–90 second demo script.

If you are behind schedule, immediately simplify the lowest-priority feature. Never let one ambitious feature prevent a complete, working end-to-end demo.

# 12. REQUIRED DEMO SCRIPT

Prepare the app so this presentation can be delivered smoothly:

1. Open The Understudy and explain: “Most automation tools make you configure every step. The Understudy learns a workflow from a demonstration.”
2. Start Teach Mode and define the attendance-report task.
3. Show the resulting editable Skill Card.
4. Approve the skill and start a run.
5. Show the runner reading the real attendance records and calculating the total.
6. Show the report fields populated.
7. Pause before submission and ask for approval.
8. Trigger the interface change from Submit to Send Report.
9. Show the original locator fail and the runner attempt a real recovery.
10. Approve submission.
11. Show the saved report and verification result.
12. Show the before/after diff and use Undo.
13. Finish with: “Teach once, approve the workflow, and let the agent handle the repetition.”

The entire flow must be rehearsable without depending on unpredictable external websites.

# 13. DEFINITION OF DONE

The project is ready only when:

- [ ] The app starts locally using documented commands.
- [ ] The dashboard is visually polished.
- [ ] Both sandbox pages work.
- [ ] The workflow can be taught or created through a clearly labelled guided flow.
- [ ] A validated Skill Card can be reviewed and edited.
- [ ] The OpenAI API is used for actual compilation when configured.
- [ ] The runner reads real attendance data.
- [ ] The runner calculates the count correctly.
- [ ] The report is filled through actual browser interactions.
- [ ] The workflow pauses before submission and requires approval.
- [ ] The interface-change scenario triggers a genuine recovery attempt.
- [ ] The submitted result is verified.
- [ ] The before/after diff reflects actual state.
- [ ] Undo restores the supported sandbox state.
- [ ] Reset Demo returns the application to a clean state.
- [ ] No critical errors remain in the main demo flow.
- [ ] README explains setup, API configuration, and known limitations.

# 14. HOW YOU MUST WORK

Follow these instructions throughout implementation:

1. Inspect the current workspace before making changes.
2. Identify existing code, available dependencies, and the fastest viable architecture.
3. Start implementing immediately. Do not return only a plan for approval.
4. Work directly in the project files.
5. Install dependencies only when needed.
6. Start the application and inspect actual runtime errors.
7. Test the main workflow from beginning to end.
8. Fix errors rather than merely listing them.
9. Do not claim to have run tests that you did not run.
10. Do not fake AI generation, recording, recovery, verification, or undo.
11. Do not leave nonfunctional controls that look operational.
12. If a feature is not implemented, disclose that limitation in the README or UI.
13. Avoid asking me questions unless a genuinely blocking decision cannot be resolved safely. Choose sensible defaults.
14. Do not waste time on deployment, elaborate branding, or features unrelated to the core demo.
15. At the end, provide concise instructions for starting the app, setting the API key, running the demo, and resetting it.

**Your highest priority is a complete, stable, impressive demonstration of teach → compile → approve → execute → recover → verify → undo within the three-hour window. Build the product now.**