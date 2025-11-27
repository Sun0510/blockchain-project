export default function LoginSuccess() {
  return (
    <div className="text-center text-white mt-20">
      <h2>로그인 완료 🎉</h2>
      <p>잠시 후 메인으로 이동합니다...</p>
      {setTimeout(() => (window.location.href = "/"), 1200)}
    </div>
  );
}
