name: ✨ Feature Request
description: Suggest an idea for Social Saver
title: "[Feature]: "
labels: ["enhancement", "feature-request"]
assignees:
  - VishalKaleria
body:
  - type: markdown
    attributes:
      value: |
        Thanks for suggesting an idea! Please describe it clearly.
  - type: textarea
    id: problem
    attributes:
      label: Is your feature request related to a problem?
      description: Please describe the problem you're trying to solve.
      placeholder: "I'm always frustrated when [...] because [...]."
    validations:
      required: true
  - type: textarea
    id: solution
    attributes:
      label: Describe the solution you'd like
      description: How do you envision this feature working in Social Saver?
      placeholder: "Add a button that does [...], or allow configuration of [...] in the settings."
    validations:
      required: true
  - type: textarea
    id: alternatives
    attributes:
      label: Describe alternatives you've considered (Optional)
      description: Are there other ways to achieve this, or other tools that do it differently?
  - type: textarea
    id: context
    attributes:
      label: Additional context (Optional)
      description: Add any other context, examples, or screenshots about the feature request here.