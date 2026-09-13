cd mobile
npx expo prebuild --platform android     # chỉ cần 1 lần, hoặc khi đổi native dep
cd android
./gradlew assembleRelease


Đúng, nhưng thiếu 1 bước — và hiện tại nó sẽ fail lại.

expo prebuild tạo lại android/ ⇒ xoá mất local.properties với ndk.dir=D:\ndk27. Không có nó là quay về lỗi CLANG_~1 y như cũ.

Hai cách:

Cách 1 — fix một lần, khỏi lo về sau (khuyên dùng). Thêm vào C:\Users\<user>\.gradle\gradle.properties:


android.ndkPath=D:\\ndk27
Hiện chưa có (m vừa check). Thêm xong thì flow của b đúng nguyên văn, không cần sửa gì.

Cách 2 — chèn thêm 1 dòng sau prebuild:


cd mobile
npx expo prebuild --platform android
echo 'ndk.dir=D\:\\ndk27' >> android/local.properties   # ← bước bị thiếu
cd android
./gradlew assembleRelease
Thêm nữa: nếu prebuild chạy lại thì nó cũng sửa package.json (npm run android → expo run:android). M đã revert lần trước; lần sau nhớ revert lại nếu vẫn muốn npm run android mở Expo Go.

B muốn m ghi luôn android.ndkPath vào file gradle cấp user không?

