import { PIN_LENGTH } from "@/lib/constants";

// specs/mobile-app-pin §UI copy.
export const PIN_COPY = {
  section: "Mã PIN",
  footer:
    "Dùng 6 số để mở khóa ứng dụng và xác minh khi chuyển tài khoản. Sai 5 lần liên tiếp thì mọi tài khoản trên máy bị đăng xuất.",
  setRow: "Đặt mã PIN",
  changeRow: "Đổi mã PIN",
  offRow: "Tắt mã PIN",

  enter: "Nhập mã PIN",
  create: `Nhập mã PIN gồm ${PIN_LENGTH} số`,
  repeat: "Nhập lại mã PIN",
  current: "Nhập mã PIN hiện tại",
  forSwitch: "Nhập mã PIN để chuyển tài khoản",

  mismatch: "Hai mã PIN chưa khớp. Nhập lại.",
  checkFailed: "Chưa kiểm tra được mã PIN. Thử lại.",
  saveFailed: "Chưa lưu được mã PIN. Nhập lại.",
  biometricFailed: "Xác thực chưa khớp. Thử lại.",

  close: "Đóng",
  forgot: "Quên mã PIN?",
  forgotMessage: "Mọi tài khoản trên máy sẽ bị đăng xuất và mã PIN bị xóa. Đăng nhập lại bằng mật khẩu để dùng tiếp.",
  forgotConfirm: "Đăng xuất mọi tài khoản",
  forgotKeep: "Giữ lại",

  set: "Đã đặt mã PIN",
  changed: "Đã đổi mã PIN",
  off: "Đã tắt mã PIN",
  offWithLock: "Đã tắt mã PIN và khóa ứng dụng.",
  wipedWrong: "Nhập sai mã PIN 5 lần. Đã đăng xuất mọi tài khoản trên máy.",
  wipedForgot: "Đã đăng xuất mọi tài khoản trên máy.",

  deleteDigit: "Xóa một số",
} as const;

export function wrongPin(triesLeft: number): string {
  return `Sai mã PIN. Còn ${triesLeft} lần thử.`;
}

export function digitKey(digit: string): string {
  return `Phím ${digit}`;
}

export function entered(count: number): string {
  return `Đã nhập ${count} trên ${PIN_LENGTH} số`;
}
