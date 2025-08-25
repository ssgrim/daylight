# GitHub Labels Color Coding System

## Priority Labels (Visual Urgency System)

| Priority | Color | Hex Code | Visual Impact |
|----------|-------|----------|---------------|
| **High Priority** | 🔴 Red | `#d73a4a` | Immediate attention required |
| **Medium Priority** | 🟠 Orange | `#ff8c00` | Important, plan to address |
| **Low Priority** | 🟡 Yellow | `#ffd700` | Address when time permits |
| **Nice to Have** | 🟢 Green | `#28a745` | Lowest priority, future consideration |

## Feature & Type Labels

| Label | Emoji | Color | Hex Code | Description |
|-------|-------|-------|----------|-------------|
| `functionality` | ⚡ | Blue | `#0366d6` | New functionality and features |
| `user-experience` | 🎨 | Light Blue | `#54c7ec` | User experience and interface improvements |
| `performance` | 🚀 | Purple | `#7b68ee` | Performance optimization and improvements |
| `infra` | 🏗️ | Green | `#28a745` | Infrastructure and deployment changes |
| `operations` | ⚙️ | Light Green | `#85e085` | Operational and maintenance tasks |
| `enhancement` | ✨ | Teal | `#20b2aa` | Feature enhancements and improvements |
| `security` | 🔒 | Red | `#ff0000` | Security-related issues and vulnerabilities |
| `bug` | 🐛 | Red | `#d73a4a` | Something isn't working correctly |
| `data-integrity` | 📊 | Pink | `#ff69b4` | Data validation and integrity issues |
| `accessibility` | ♿ | Gold | `#ffa500` | Accessibility compliance and improvements |
| `documentation` | 📚 | Light Gray | `#d1d5da` | Documentation improvements and additions |

## Usage Guidelines

### Priority Labeling
- **Always** assign one priority label to each issue
- Use the visual color coding to quickly identify urgent items
- Red = Drop everything and fix
- Orange = Plan and schedule
- Yellow = Next sprint consideration
- Green = Backlog for future

### Feature Labeling
- Assign 1-3 feature labels per issue as appropriate
- Emojis make labels scannable at a glance
- Colors group related functionality types

### Label Combinations
Example effective combinations:
- `high-priority` + `bug` + `security` = Critical security fix
- `medium-priority` + `functionality` + `user-experience` = Important new feature
- `low-priority` + `enhancement` + `performance` = Nice optimization
- `nice-to-have` + `accessibility` = Future accessibility improvement

## Removed Labels
The following unused labels were removed for clarity:
- `duplicate`, `good first issue`, `help wanted`, `invalid`, `question`, `wontfix`
- `stability`, `testing`, `devops`, `monitoring`, `caching`, `perf`

This cleanup reduces label noise and focuses on actionable categorization.
