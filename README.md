use this flow:
/cook-state          ← chạy đầu session mới / sau mỗi feature xong
/cook-ba             ← BA: tìm đúng feature, spec nó
/cook-plan           ← Architect: plan từ spec vừa tạo
/cook-implementation ← Dev: code theo plan
/cook-qc             ← QC: test cases từ spec + plan + code (NEW)
/renew-docs          ← định kỳ: sync architecture.md + tech_stacks.md
/renew-features      ← định kỳ: refresh roadmap + hỏi clarification