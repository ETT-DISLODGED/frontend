//import { jwtDecode } from "/node_modules/.vite/deps/jwt-decode.js";
import jwt_decode from "jwt-decode";

import { fetchUserInfo } from "../lib/api.js";

export class jwtUtils {
  // 토큰 유효성 검사
  static isAuth(token) {
    if (!token) {
      return false;
    }
    const decoded = jwt_decode(token);
    if (decoded.exp > new Date().getTime() / 1000) {
      return true;
    } else {
      return false; //만료되면 refresh토큰 통해서 access토큰 가져오도록 구현해야함
    }
  }
  // 토큰에서 유저 id 가져오기
  static getId(token) {
    const decoded = jwt_decode(token);
    return decoded.jti;
  }

  static async getNickname(token) {
    try {
      const userInfo = await fetchUserInfo(token);
      return userInfo.nickname; // 예: 사용자 정보 객체에서
    } catch (error) {
      console.error("사용자 이름을 가져오는 데 실패했습니다.", error);
      return null; // 오류 발생 시 null 반환
    }
  }
}
