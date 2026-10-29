# Translations: Budget wizard

> Scope: `src/features/budget-wizard` (opened from the Assistant's "Lập ngân sách" mode, the Budgets empty state and the Budgets add button). Three steps (income, living situation, result) plus a success screen and its sheets. 131 rows. Conventions and `common.*` keys: [translations.md](./translations.md).

Terms used here that are not yet in `glossary.md` (add before adoption): **hạn mức** = limit, **dự phòng** = buffer (money not yet given to any category), **kế hoạch** = plan, **chi phí cố định** = fixed costs, **để dành / tiết kiệm** = set aside / savings, **kiểu sống** = living situation, **chu kỳ** = cycle, **lương về ngày** = payday, **mục** (a row of the plan) = category.

## Step 1: income (`WizardStepIncome`)

### Income step (`mobile/src/features/budget-wizard/components/WizardStepIncome.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgetWizard.income.title` | Mỗi tháng bạn có bao nhiêu? | How much do you get each month? | WizardStepIncome.tsx:116 | Step title |
| `budgetWizard.income.restored` | Đã điền từ kế hoạch lưu ngày / `{formatSavedAt(…)}` / . | Filled in from the plan saved on {{date}}. | WizardStepIncome.tsx:124 | refactor: text + date. `formatSavedAt` (saved-plan.ts:176) hand-builds dd/mm/yyyy: use the shared date formatter. VI: "Đã điền từ kế hoạch lưu ngày {{date}}." |
| `budgetWizard.income.startOver` | Bắt đầu lại | Start over | WizardStepIncome.tsx:128 | Text link: discards the saved plan |
| `budgetWizard.income.incomeLabel` | Thu nhập hàng tháng | Monthly income | WizardStepIncome.tsx:136 | Field label |
| `budgetWizard.income.fixedLabel` | Chi phí cố định | Fixed costs | WizardStepIncome.tsx:145 | Field label; same text as the fixed-costs sheet title (separate key) |
| `budgetWizard.income.fixedHint` | nhà, điện nước, internet, học phí | rent, utilities, internet, school fees | WizardStepIncome.tsx:149 | Hint under the field, lower case; replaced by the item list once the helper ran |
| `budgetWizard.income.editFixedItems` | `Sửa ${breakdown.length} khoản` | one: Edit {{count}} cost · other: Edit {{count}} costs | WizardStepIncome.tsx:157 | Action on the hint row. VI: "Sửa {{count}} khoản" |
| `budgetWizard.income.unknownTotal` | Tôi không nhớ tổng → | I don't know the total → | WizardStepIncome.tsx:157 | User-voice action ("Tôi" is the user, not the app) |
| `budgetWizard.income.paydayLabel` | Lương về ngày | Payday | WizardStepIncome.tsx:177 | Label above the day-of-month chips (chips are numbers) |
| `budgetWizard.income.cycleLength` | Chu kỳ này dài / ngày. | one: This cycle is {{count}} day long. · other: This cycle is {{count}} days long. | WizardStepIncome.tsx:193 | refactor: `Chu kỳ này dài {days} ngày.` VI: "Chu kỳ này dài {{count}} ngày." |
| `budgetWizard.income.leftToSpend` | Còn được chi | Left to spend | WizardStepIncome.tsx:207 | Label above the disposable amount |
| `budgetWizard.income.perDay` | `${formatCurrency(perDay, currency)}\nmỗi ngày` | {{amount}}\nper day | WizardStepIncome.tsx:213 | Line break is part of the value |
| `budgetWizard.income.next` | Tiếp → | Next → | WizardStepIncome.tsx:226 | Wizard step button ("Tiếp tục"-type wording is allowed in multi-step wizards, patterns §2) |

### Savings field (`mobile/src/features/budget-wizard/components/WizardSavingsField.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgetWizard.savings.label` | Muốn để dành | Set aside | WizardSavingsField.tsx:46 | Field label, amount on the right |
| `budgetWizard.savings.none` | Chưa | None | WizardSavingsField.tsx:61 | Chip for 0%; other chips are percentages ("10%") formatted by `Intl` |
| `budgetWizard.savings.custom` | Số khác | Other amount | WizardSavingsField.tsx:76 | Chip |
| `budgetWizard.savings.defaultHint` | Mức dễ giữ. Tháng sau dư thì tăng lên. | Easy to keep up. Raise it next month if there's money left. | WizardSavingsField.tsx:86 | |
| `budgetWizard.savings.promptTitle` | Muốn để dành bao nhiêu? | How much to set aside? | WizardSavingsField.tsx:92 | AmountPromptModal title |
| `budgetWizard.savings.promptHint` | Không quá thu nhập | Up to your income | WizardSavingsField.tsx:93 | AmountPromptModal hint |

### Income validation (`mobile/src/features/budget-wizard/budget-math.ts`)

Inline errors under the income / fixed-cost fields.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgetWizard.validation.incomeRequired` | Nhập thu nhập lớn hơn 0. | Enter an income above 0. | budget-math.ts:129 | |
| `budgetWizard.validation.incomeMax` | `Thu nhập tối đa ${formatCurrency(INCOME_CAP_XU)}.` | The maximum income is {{amount}}. | budget-math.ts:133 | patterns §4 "vượt giới hạn" |
| `budgetWizard.validation.overIncome` | Chi phí cố định và tiết kiệm vượt thu nhập. Giảm một trong hai khoản. | Fixed costs and savings are more than your income. Lower one of them. | budget-math.ts:140 | Mirrors server `DISPOSABLE_NONPOSITIVE` (translations-errors.md) |
| `budgetWizard.validation.tooLittleLeft` | Phần còn lại quá ít để chia theo danh mục. Giảm tiết kiệm hoặc chi phí cố định. | Too little is left to split across categories. Lower savings or fixed costs. | budget-math.ts:147 | Mirrors server `DISPOSABLE_TOO_SMALL` |

### Fixed-costs sheet (`mobile/src/features/budget-wizard/components/FixedCostsModal.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgetWizard.fixedCosts.placeholder` | thuê nhà 3m / tháng, đổ rác 50k/tháng, gửi xe máy 100k, phí quản lý 200k/tháng, điện 300k, nước 500k, internet 160k, học phí 5m | rent 3m/month, trash 50k/month, motorbike parking 100k, building fee 200k/month, electricity 300k, water 500k, internet 160k, school fees 5m | FixedCostsModal.tsx:32 | placeholder. ⚠️ The parser (`fixed-costs.ts`) reads Vietnamese labels and VI number punctuation; EN text only parses amounts. See open question below |
| `common.action.cancel` | Huỷ | (common) | FixedCostsModal.tsx:158 | Old spelling; VI locale value "Hủy" |
| `budgetWizard.fixedCosts.title` | Chi phí cố định | Fixed costs | FixedCostsModal.tsx:161 | Sheet title |
| `budgetWizard.fixedCosts.confirm` | Dùng số này | Use this total | FixedCostsModal.tsx:168 | Header action |
| `budgetWizard.fixedCosts.rescaled` | Bạn vừa đổi tổng chi phí cố định, nên các khoản dưới đây đã được chia lại theo đúng tỉ lệ cũ. Bạn sửa lại khoản nào cũng được. | The total changed, so these costs were rescaled to keep their shares. Edit any of them. | FixedCostsModal.tsx:177 | VI breaks the skill ("Bạn", passive "đã được", explains at length); proposed VI: "Tổng đã đổi nên các khoản dưới đây được chia lại theo tỉ lệ cũ. Sửa khoản nào cũng được." |
| `budgetWizard.fixedCosts.inputLabel` | Kể ra những khoản cố định của bạn | List your fixed costs | FixedCostsModal.tsx:182 | Field label |
| `budgetWizard.fixedCosts.inputHint` | Viết tự nhiên, cách nhau bằng dấu phẩy. &quot;3m&quot; = 3 triệu, &quot;50k&quot; = 50 nghìn. | Separate costs with commas. "3m" = 3 million, "50k" = 50 thousand. | FixedCostsModal.tsx:193 | |
| `budgetWizard.fixedCosts.hidePrompts` | Ẩn danh sách gợi ý | Hide the list | FixedCostsModal.tsx:198 | Toggle, open state |
| `budgetWizard.fixedCosts.showPrompts` | Hoặc để tôi hỏi từng khoản → | Or fill in one by one → | FixedCostsModal.tsx:198 | Toggle, closed state. VI breaks the skill (app speaks as "tôi", rule 7); proposed VI: "Hoặc điền từng khoản →" |
| `budgetWizard.fixedCosts.covered` | đã có trong mô tả | already in your list | FixedCostsModal.tsx:218 | Shown in place of an input |
| `budgetWizard.fixedCosts.customPlaceholder` | Khoản khác | Other cost | FixedCostsModal.tsx:241 | placeholder |
| `budgetWizard.fixedCosts.addCustom` | + Thêm khoản khác | + Add another cost | FixedCostsModal.tsx:265 | |
| `common.field.total` | Tổng | (common) | FixedCostsModal.tsx:281 | |
| `budgetWizard.fixedCosts.nothingParsed` | Chưa đọc được khoản nào. Bạn viết dạng &quot;điện 300k&quot; nhé. | No costs found yet. Write them like "electricity 300k". | FixedCostsModal.tsx:288 | VI breaks the skill ("Bạn", "nhé"); proposed VI: "Chưa đọc được khoản nào. Viết dạng "điện 300k"." |
| (no key today) | ✕ | Remove {{name}} | FixedCostsModal.tsx:255 | a11y gap: the remove glyph has no `accessibilityLabel`; add `budgetWizard.fixedCosts.remove.a11y` when migrating. VI: "Xóa {{name}}" |

### Fixed-cost prompts (`mobile/src/features/budget-wizard/fixed-costs.ts`)

Rows of the guided list. The `key` column in code (unaccented VI) is a matching key, not copy.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgetWizard.fixedCost.rent` | Thuê nhà / trả góp | Rent / mortgage | fixed-costs.ts:160 | |
| `budgetWizard.fixedCost.electricity` | Điện | Electricity | fixed-costs.ts:161 | |
| `budgetWizard.fixedCost.water` | Nước | Water | fixed-costs.ts:162 | |
| `budgetWizard.fixedCost.internet` | Internet | Internet | fixed-costs.ts:163 | Diacritic-free; same in both languages but keyed so the list stays one source |
| `budgetWizard.fixedCost.serviceFee` | Phí quản lý / dịch vụ | Building / service fees | fixed-costs.ts:164 | |
| `budgetWizard.fixedCost.parking` | Gửi xe | Parking | fixed-costs.ts:165 | |
| `budgetWizard.fixedCost.schoolFees` | Học phí | School fees | fixed-costs.ts:166 | |
| `budgetWizard.fixedCost.insurance` | Bảo hiểm | Insurance | fixed-costs.ts:167 | |

## Step 2: living situation (`WizardStepProfile`)

### Profile step (`mobile/src/features/budget-wizard/components/WizardStepProfile.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgetWizard.profile.title` | Bạn đang sống kiểu nào? | What's your living situation? | WizardStepProfile.tsx:74 | Step title |
| `budgetWizard.profile.subtitle` | Ngân sách khởi điểm dựa trên câu trả lời này. | Your starting budgets are based on this answer. | WizardStepProfile.tsx:75 | |

### Presets (`mobile/src/features/budget-wizard/types.ts`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgetWizard.preset.rented_eating_out.label` | Ở trọ, đi làm | Renting, working | types.ts:111 | Option title |
| `budgetWizard.preset.rented_eating_out.description` | Tiền nhà, ăn ngoài và đi lại chiếm phần lớn. | Rent, eating out and getting around take most of it. | types.ts:112 | |
| `budgetWizard.preset.with_family.label` | Ở với gia đình | Living with family | types.ts:117 | |
| `budgetWizard.preset.with_family.description` | Ít tiền nhà và tiền ăn, dư nhiều hơn cho mục khác. | Little rent or food, more left for other things. | types.ts:118 | |
| `budgetWizard.preset.couple_no_kids.label` | Vợ chồng son | Couple, no kids | types.ts:126 | |
| `budgetWizard.preset.couple_no_kids.description` | Hai người, chưa có con. Ăn ngoài và đi chơi nhiều hơn. | Two people, no children yet. More eating and going out. | types.ts:127 | |
| `budgetWizard.preset.own_family.label` | Có gia đình riêng | Family with kids | types.ts:132 | The preset allocates to children/education |
| `budgetWizard.preset.own_family.description` | Thêm chi phí cho con và sinh hoạt cả nhà. | Adds costs for children and the household. | types.ts:133 | |
| `budgetWizard.preset.student.label` | Sinh viên | Student | types.ts:138 | |
| `budgetWizard.preset.student.description` | Thu nhập thấp, chi tiêu gọn quanh ăn uống và đi lại. | Low income, spending mostly on food and getting around. | types.ts:139 | |
| `budgetWizard.preset.retired.label` | Đã nghỉ hưu | Retired | types.ts:146 | |
| `budgetWizard.preset.retired.description` | Chi tiêu đều đặn, y tế chiếm phần lớn hơn. | Steady spending, with a bigger share for health. | types.ts:147 | |

## Step 3: result (`WizardStepResult`)

### Result step (`mobile/src/features/budget-wizard/components/WizardStepResult.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgetWizard.result.loadError` | Chưa tính được ngân sách. | Couldn't work out your budgets. | WizardStepResult.tsx:143 | Fallback when no error text is set |
| `common.action.retry` | Thử lại | (common) | WizardStepResult.tsx:145 | |
| `budgetWizard.result.estimateNotice` | Ước lượng theo kiểu sống đã chọn, chưa theo chi tiêu thật. Sửa lại bất cứ lúc nào. | Estimated from your living situation, not your real spending. Edit any time. | WizardStepResult.tsx:161 | |
| `budgetWizard.result.perDayLabel` | Được chi mỗi ngày | To spend per day | WizardStepResult.tsx:166 | Label above the headline amount |
| `budgetWizard.result.emptyPlan` | Kế hoạch chưa có danh mục. Thêm ít nhất một mục để lưu. | The plan has no categories. Add at least one to save it. | WizardStepResult.tsx:180 | |
| `budgetWizard.result.addCategory` | + Thêm danh mục | + Add category | WizardStepResult.tsx:199 | |
| `budgetWizard.result.addCategoryHint` | lấy từ dự phòng | from the buffer | WizardStepResult.tsx:200 | Secondary line of the add row |

### Proposal row (`mobile/src/features/budget-wizard/components/ProposalRow.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgetWizard.result.row.why` | · vì sao? | · why? | ProposalRow.tsx:63 | Appended to the confidence label or the server's `evidence` text; becomes one key `"{{source}} · why?"` with `<Trans>` for the muted part. VI: "{{source}} · vì sao?" |
| `budgetWizard.result.row.from` | từ | from {{amount}} | ProposalRow.tsx:74 | refactor: `từ {formatCurrency(amount_min)}`. VI: "từ {{amount}}" |
| (no key today) | ✕ | Remove {{category}} | ProposalRow.tsx:81 | a11y gap: remove glyph without `accessibilityLabel`; add `budgetWizard.result.row.remove.a11y`. VI: "Bỏ {{category}}" |

### Confidence labels (`mobile/src/features/budget-wizard/types.ts`)

Shown on each row and, with the explanation, in the confidence popup.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgetWizard.confidence.manual.label` | bạn tự đặt | set by you | types.ts:176 | Lower case, sits after the row name |
| `budgetWizard.confidence.manual.explanation` | Số do bạn nhập hoặc sửa, không phải ước lượng. | A figure you entered or edited, not an estimate. | types.ts:177 | |
| `budgetWizard.confidence.history.label` | từ lịch sử chi tiêu | from your spending history | types.ts:182 | |
| `budgetWizard.confidence.history.explanation` | Tính từ giao dịch đã ghi, nên sát với chi tiêu thật. | Worked out from your saved transactions, so close to what you really spend. | types.ts:183 | |
| `budgetWizard.confidence.estimate.label` | ước lượng | estimate | types.ts:188 | |
| `budgetWizard.confidence.estimate.explanation` | Dựa trên kiểu sống đã chọn, chưa dựa trên chi tiêu thật. Sửa lại bất cứ lúc nào. | Based on your living situation, not your real spending. Edit any time. | types.ts:189 | |

### Confidence popup (`mobile/src/features/budget-wizard/components/ConfidencePopup.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.action.gotIt` | Đã hiểu | (common) | ConfidencePopup.tsx:48 | |

### Segment legend (`mobile/src/features/budget-wizard/components/SegmentLegend.tsx`, `proposal-segments.ts`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgetWizard.result.segmentHint` | Chạm từng khúc để xem tên mục. | Tap a segment to see its category. | SegmentLegend.tsx:40 | |
| `budgetWizard.result.bufferSegment` | Dự phòng (chưa thuộc mục nào) | Buffer (not in any category) | proposal-segments.ts:53 | Legend name for the unallocated block |

### Plan summary rows (`mobile/src/features/budget-wizard/components/WizardPlanSummaryRows.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgetWizard.summary.buffer` | Dự phòng | Buffer | WizardPlanSummaryRows.tsx:39 | |
| `budgetWizard.summary.savings` | Tiết kiệm | Savings | WizardPlanSummaryRows.tsx:48 | |
| `budgetWizard.summary.fixed` | Cố định | Fixed costs | WizardPlanSummaryRows.tsx:52 | |
| `budgetWizard.summary.overCommitted` | Tổng các mục vượt số được chi / `{formatCurrency(shortfall)}` / . Giảm bớt một vài mục. | Categories add up to {{amount}} more than you can spend. Lower a few. | WizardPlanSummaryRows.tsx:59 | refactor: two fragments around the amount. VI: "Tổng các mục vượt số được chi {{amount}}. Giảm bớt một vài mục." |

### Footer (`mobile/src/features/budget-wizard/components/WizardResultFooter.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgetWizard.footer.planSaved` | Đã lưu kế hoạch | Plan saved | WizardResultFooter.tsx:54 | Ghost button, done state |
| `budgetWizard.footer.savePlan` | Lưu để dùng sau | Save for later | WizardResultFooter.tsx:54 | Ghost button |
| `budgetWizard.footer.saving` | Đang lưu… | Saving… | WizardResultFooter.tsx:65 | Primary button, busy |
| `budgetWizard.footer.apply` | Áp dụng ngân sách | Apply budgets | WizardResultFooter.tsx:65 | Primary button |
| `budgetWizard.overwrite.title` | Thay ngân sách hiện tại? | Replace current budgets? | WizardResultFooter.tsx:78 | ⚠️ Confirm before `POST /budgets/bulk` replaces every active budget |
| `budgetWizard.overwrite.body` | Mọi ngân sách hiện tại sẽ bị thay bằng kế hoạch này. Không thể hoàn tác. | This plan replaces all your current budgets. This can't be undone. | WizardResultFooter.tsx:79 | |
| `budgetWizard.overwrite.confirm` | Thay ngân sách | Replace budgets | WizardResultFooter.tsx:80 | Destructive button; safe branch is ConfirmDialog's default "Hủy" today, should be `common.action.keep` per glossary |

### Add-category sheet (`mobile/src/features/budget-wizard/components/AddBudgetRowModal.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgetWizard.addRow.title` | Thêm danh mục | Add category | AddBudgetRowModal.tsx:93 | Sheet title (buffer-empty variant) |
| `common.action.close` | Đóng | (common) | AddBudgetRowModal.tsx:93 | |
| `budgetWizard.addRow.noBuffer` | Dự phòng đã hết. Giảm một mục khác để thêm mục mới. | No buffer left. Lower another category to add one. | AddBudgetRowModal.tsx:98 | |
| `budgetWizard.addRow.matchesTitle` | Dùng mục có sẵn? | Use an existing category? | AddBudgetRowModal.tsx:110 | Sheet title |
| `common.action.back` | Quay lại | (common) | AddBudgetRowModal.tsx:111 | |
| `budgetWizard.addRow.matchesBody` | Có vài mục giống &quot; / `{name.trim()}` / &quot;. | Some categories look like "{{name}}". | AddBudgetRowModal.tsx:115 | refactor: two JSX fragments around the typed name (the `&quot;.` half was found by the secondary search). VI: "Có vài mục giống "{{name}}"." |
| `budgetWizard.addRow.match.onPlan` | đã có trong kế hoạch | already in the plan | AddBudgetRowModal.tsx:135 | Row meta, row disabled |
| `budgetWizard.addRow.match.yours` | của bạn | yours | AddBudgetRowModal.tsx:135 | Row meta: a category the user made |
| `budgetWizard.addRow.match.system` | mục hệ thống | default | AddBudgetRowModal.tsx:135 | Row meta: system category. Glossary: system category = "mặc định" / "default"; proposed VI: "mặc định" |
| `budgetWizard.addRow.createAnyway` | Không, tạo mục &quot; / `{name.trim()}` / &quot; mới | Create "{{name}}" as new | AddBudgetRowModal.tsx:148 | refactor: fragments around the name. VI starts with "Không," (rule 6: button names the action); proposed VI: "Tạo mục mới "{{name}}"" |
| `budgetWizard.addRow.formTitle` | Thêm danh mục | Add category | AddBudgetRowModal.tsx:155 | Sheet title (form) |
| `common.action.cancel` | Hủy | (common) | AddBudgetRowModal.tsx:157 | |
| `common.action.add` | Thêm | (common) | AddBudgetRowModal.tsx:158 | |
| `budgetWizard.addRow.nameLabel` | Tên danh mục | Category name | AddBudgetRowModal.tsx:162 | |
| `budgetWizard.addRow.namePlaceholder` | vd: Thú cưng | e.g. Pets | AddBudgetRowModal.tsx:167 | placeholder |
| `budgetWizard.addRow.amountLabel` | Mỗi tháng muốn chi | Monthly amount | AddBudgetRowModal.tsx:172 | |
| `budgetWizard.addRow.maxFromBuffer` | Lấy từ dự phòng, tối đa | From the buffer, up to | AddBudgetRowModal.tsx:189 | Label; the amount is a separate value cell on the same row |
| `budgetWizard.addRow.minimum` | Tối thiểu / . Thấp hơn thì một lần chi bình thường đã vượt hạn mức. | Minimum {{amount}}. Any less and one normal purchase would go over the limit. | AddBudgetRowModal.tsx:194 | refactor: two fragments around the amount. VI: "Tối thiểu {{amount}}. Thấp hơn thì một lần chi bình thường đã vượt hạn mức." |

### Edit-amount sheet (`mobile/src/features/budget-wizard/components/EditAmountModal.tsx`)

Title is the category name.

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.action.cancel` | Hủy | (common) | EditAmountModal.tsx:70 | |
| `common.action.save` | Lưu | (common) | EditAmountModal.tsx:72 | |
| `budgetWizard.editAmount.maxRaise` | Tối đa có thể nâng | Can raise to | EditAmountModal.tsx:97 | Label, amount beside it |
| `budgetWizard.editAmount.bufferLeft` | Dự phòng còn lại | Buffer left | EditAmountModal.tsx:102 | Label, amount beside it |
| `budgetWizard.editAmount.takeMore` | `Lấy thêm ${formatCurrency(delta, currency)} từ dự phòng. Các mục khác giữ nguyên.` | Takes {{amount}} more from the buffer. Other categories stay the same. | EditAmountModal.tsx:112 | |
| `budgetWizard.editAmount.giveBack` | `Trả lại ${formatCurrency(-delta, currency)} vào dự phòng.` | Returns {{amount}} to the buffer. | EditAmountModal.tsx:113 | |

### Back confirmation (`mobile/src/features/budget-wizard/components/WizardBackConfirmDialog.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgetWizard.backConfirm.title` | Giữ lại các danh mục? | Keep your categories? | WizardBackConfirmDialog.tsx:33 | |
| `budgetWizard.backConfirm.body` | Bạn sắp đổi câu trả lời trước đó. Các danh mục bạn đã chọn sẽ được giữ nguyên, còn số tiền sẽ được tính lại theo câu trả lời mới. | You're changing an earlier answer. Your categories stay, and amounts are recalculated from the new answer. | WizardBackConfirmDialog.tsx:35 | VI breaks the skill ("Bạn", passive "sẽ được"); proposed VI: "Đổi câu trả lời trước. Danh mục đã chọn giữ nguyên, số tiền tính lại theo câu trả lời mới." |
| `budgetWizard.backConfirm.keep` | Giữ lại | Keep categories | WizardBackConfirmDialog.tsx:39 | Not the delete-confirm "Keep": here it is the primary choice, so EN names the object |
| `budgetWizard.backConfirm.discard` | Làm lại từ đầu | Start over | WizardBackConfirmDialog.tsx:40 | |
| `budgetWizard.backConfirm.stay` | Ở lại màn hình này | Stay here | WizardBackConfirmDialog.tsx:43 | Text link |

### Progress header (`mobile/src/features/budget-wizard/components/WizardProgressHeader.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `common.action.back` | Quay lại | (common) | WizardProgressHeader.tsx:43 | a11y |
| `common.action.close` | Đóng | (common) | WizardProgressHeader.tsx:65 | a11y |

## Success screen (`WizardStepSuccess`)

### Success (`mobile/src/features/budget-wizard/components/WizardStepSuccess.tsx`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgetWizard.success.perDay` | Từ hôm nay bạn có / `{dailyAllowance}` / mỗi ngày | From today you have {{amount}} a day | WizardStepSuccess.tsx:114 | refactor: two fragments around a styled amount; `<Trans>` with `<0>{{amount}}</0>`. VI: "Từ hôm nay bạn có <0>{{amount}}</0> mỗi ngày" |
| `budgetWizard.success.created` | `Đã tạo ${createdCount} ngân sách` | one: Created {{count}} budget · other: Created {{count}} budgets | WizardStepSuccess.tsx:117 | Title when there is no per-day figure. VI: "Đã tạo {{count}} ngân sách" |
| `budgetWizard.success.saved` | Đã lưu ngân sách | Budgets saved | WizardStepSuccess.tsx:119 | Title fallback |
| `budgetWizard.success.readyCount` | `{createdCount}` ngân sách đã sẵn sàng | one: {{count}} budget ready · other: {{count}} budgets ready | WizardStepSuccess.tsx:126 | refactor: count + text. VI: "{{count}} ngân sách đã sẵn sàng" |
| `common.action.done` | Xong | (common) | WizardStepSuccess.tsx:137 | |

## Errors and server-state messages

### State hooks (`mobile/src/features/budget-wizard/hooks/use-budget-wizard-state.ts`, `use-wizard-submit.ts`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgetWizard.error.proposalFailed` | Chưa tính được ngân sách. Thử lại. | Couldn't work out your budgets. Try again. | use-budget-wizard-state.ts:169 | `getErrorMessage` fallback; server `message` wins today. Map `DISPOSABLE_NONPOSITIVE`, `DISPOSABLE_TOO_SMALL`, `TOO_MANY_BUDGETS`, `PLAN_VERSION_CONFLICT` by code (translations-errors.md) |
| `budgetWizard.error.emptyPlan` | Kế hoạch đang trống. Thêm ít nhất một danh mục trước khi lưu. | The plan is empty. Add at least one category to save it. | use-budget-wizard-state.ts:383 | |
| `budgetWizard.error.saveFailed` | Chưa lưu được ngân sách. Thử lại. | Couldn't save the budgets. Try again. | use-wizard-submit.ts:58 | No balance/data statement: the bulk replace is atomic server-side, but the client creates new categories first (not atomic with it) |

### Server not ready (`mobile/src/features/budget-wizard/preset-intents.ts`)

| Key | VI (current) | EN (proposed) | Source | Notes |
|---|---|---|---|---|
| `budgetWizard.problem.serverOutdated` | Máy chủ chưa hỗ trợ phiên bản thiết lập ngân sách này. Bạn cập nhật lại máy chủ rồi thử lại nhé. | The server doesn't support this budget setup yet. Update the server, then try again. | preset-intents.ts:10 | VI breaks the skill ("Bạn", "nhé"); proposed VI: "Máy chủ chưa hỗ trợ cách lập ngân sách này. Cập nhật máy chủ rồi thử lại." |
| `budgetWizard.problem.categoriesUnmigrated` | Danh mục hệ thống trên máy chủ chưa được cập nhật nên chưa khớp được với các gói gợi ý. | Default categories on the server are out of date and don't match the suggested plans. | preset-intents.ts:12 | Glossary: system category = "default" in EN |

## Text from the server on these screens

Stays Vietnamese in an English UI until the backend localises it (spec.md):

- `entry.evidence` on proposal rows ("ProposalRow.tsx:62"), category names on the plan (system categories translate via `system_key`; user categories never), and any `message` behind `getErrorMessage` in the two hooks above.

## Not translated

| Source | VI | Reason |
|---|---|---|
| fixed-costs.ts (keys `"thue nha"`, `"dien"`, …; unit words "ngh", "tri", "tr") | thuê nhà, điện, nghìn, triệu … | Matching vocabulary for the user's own typed text, not copy (only the `label` fields above are UI) |

## Open question for this area

- The fixed-costs free-text helper parses Vietnamese labels and Vietnamese number punctuation ("1,5tr" = 1.5 million). In English the placeholder and hint above invite "rent 3m", which parses the amount but no prompt key (rent ≠ "thue nha"), and "1.5m" would read with VI rules. Options: keep the helper VI-only and hide the free-text box in EN (guided list only), or add an EN vocabulary and locale-aware decimal parsing.
