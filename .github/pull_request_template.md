# 📌 Frontend PR

## 📝 Description
<!-- 
Provide a short summary of the changes introduced in this PR.
Add screenshots or screen recordings if applicable.
Mention any test cases tested manually here (ideally create automated tests for them).
-->

## 🔗 Related Linear Issue
<!-- 
- Ensure a Linear issue exists for this PR.
- Copy the branch name from Linear so the PR is linked automatically.
- PR title format: [feat|fix|refactor|chore]: <Linear issue title> 
  Example: feat: Add new dashboard filters
-->

## ✅ PR Format
- [ ] Linear issue created and linked.
- [ ] Branch name copied from Linear.
- [ ] PR title includes correct prefix (`feat/ fix/ refactor/ chore`).
- [ ] Screenshots / description added.
- [ ] Manual test cases mentioned (if no unit test added).

---

## 💻 Code Checklist
- [ ] Mixpanel events added where required (`Creative:` prefix).
- [ ] Avoid unnecessary `useEffect`.
- [ ] Loading, error, and empty states handled with null checks.
- [ ] Complex logic commented.
- [ ] Complex logic extracted to util functions + unit tests written.
- [ ] All English text stored in constants files.
- [ ] Proper `queryKeys` used (with orgNames), and invalidation handled.
- [ ] Functionality tested properly, cases mentioned in PR description.

---

## 🎨 Design Checklist
- [ ] Hover, active, and font styles match Figma.
- [ ] UI tested at different screen sizes / zoom levels (no overflow or misalignment).
- [ ] Icons verified.
- [ ] Tooltips added where needed (copies reviewed with Shayan/Claude).

---

## 🚀 Reviewer Notes
<!-- 
Add any specific areas where you’d like feedback from reviewers.
-->
