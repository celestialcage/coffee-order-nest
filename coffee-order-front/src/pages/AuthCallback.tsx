// import { useEffect } from "react";
// import { useNavigate } from "react-router-dom";
// import { completeLogin } from "../lib/api";

// /** 백엔드가 로그인 후 돌려보내는 곳: /auth/callback#token=... */
// export default function AuthCallback() {
//   const navigate = useNavigate();

//   useEffect(() => {
//     completeLogin(); // 실패해도 홈으로 보낸다 (홈이 로그인 화면을 보여줌)
//     navigate("/", { replace: true });
//   }, [navigate]);

//   return <div className="page muted">로그인 중...</div>;
// }
