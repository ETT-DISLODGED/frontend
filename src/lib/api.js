import axios from "axios";
import store from "../redux/configStore";
import { jwtUtils } from "../util/jwtUtils";
import { useDispatch } from "react-redux";
import { useNavigate } from "react-router-dom";

// 서버 측에서 준 배포 url
const BASE_URL = "https://dislodged.shop";

const client = axios.create({
  baseURL: BASE_URL,
  timeout: 5000,
  headers: {
    "Content-Type": "application/json"
  }
});

/**
 1. 요청 인터셉터
 2개의 콜백 함수를 받기.
 */
client.interceptors.request.use(
  async (config) => {
    // HTTP Authorization 요청 헤더에 jwt-token을 넣음
    // 서버측 미들웨어에서 이를 확인하고 검증한 후 해당 API에 요청함.
    console.log("Request Interceptor", config.url);
    const token = store.getState().Auth.token;
    try {
      if (token) {
        if (jwtUtils.isAuth(token)) {
          config.headers.Authorization = `Bearer ${token}`;
        }
      }

      return config;
    } catch (err) {
      console.error("[_axios.interceptors.request] config : " + err);
    }
  },
  (error) => {
    console.log("Request Interceptor Error", error);
    // 요청 에러 직전 호출됨
    return Promise.reject(error);
  }
);

// refresh로 access 새로 받는 api 호출
export const newAccessToken = async (refreshToken) => {
  if (!refreshToken) {
    console.error("No refresh token available.");
    throw new Error("No refresh token.");
  }
  try {
    // 로그인 요청 보내기
    const response = await client.post("/accounts/refresh/token", {
      refresh: refreshToken
    });
    if (response.status === 200) {
      // Redux Store의 상태를 업데이트하고 새 토큰을 반환
      console.log(response.data.access);
      store.dispatch(setToken(response.data.access));
      return response.data.access;
    }
  } catch (error) {
    // 요청이 실패했을 때
    console.error("새로운 액세스 토큰 요청 실패:", error);
    throw error;
  }
};

/**
 2. 응답 인터셉터
 2개의 콜백 함수를 받음.
 */
client.interceptors.response.use(
  (response) => {
    /*
        http status가 200인 경우
        응답 성공 직전 호출됨.
        .then() 으로 이어짐.
    */
    console.log("Response Interceptor", response.config.url);
    return response;
  },

  async (error) => {
    console.log(
      "Response Interceptor Error",
      error.response?.status,
      error.config.url
    );
    // 서버에서 401 Unauthorized 응답을 받으면
    const originalRequest = error.config;
    if (error.response.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;
      const refreshToken = store.getState().Auth.refreshToken;

      try {
        console.log("Access token expired. Trying to refresh it...");
        const newToken = await newAccessToken(refreshToken);
        console.log("New access token received:", newToken); // 새 토큰 발급 성공 로그
        if (newToken) {
          // client 인스턴스의 기본 헤더를 갱신
          client.defaults.headers.common[
            "Authorization"
          ] = `Bearer ${newToken}`;

          // 실패한 요청에 대해 헤더를 갱신하여 재요청
          originalRequest.headers["Authorization"] = `Bearer ${newToken}`;
          // 재시도하는 요청을 다시 보냄
          return client(originalRequest);
        }
      } catch (refreshError) {
        // 새 Access Token을 받아오는데 실패한 경우
        console.error("Unable to refresh access token:", refreshError);
        throw refreshError;
      }
    }

    return Promise.reject(error);
  }
);

export default client;

// 회원가입 POST
export const signUp = async (userData) => {
  try {
    // 회원가입 요청 보내기
    const response = await client.post("/accounts/signup/", userData);

    // 성공적으로 응답을 받았을 때
    return response.data;
  } catch (error) {
    // 요청이 실패했을 때
    console.error("회원가입 요청 실패:", error);
    throw error;
  }
};

export const login = async (userData) => {
  try {
    // 로그인 요청 보내기
    const response = await client.post("/accounts/login/", userData);
    return response.data;
  } catch (error) {
    // 요청이 실패했을 때
    console.error("로그인 요청 실패:", error);
    throw error;
  }
};

//마이페이지에 유저정보 가져오기
export const getUser = async () => {
  try {
    const response = await client.get("/accounts/login/");
    return response.data;
  } catch (error) {
    // 요청이 실패했을 때
    console.error("로그인 요청 실패:", error);
    throw error;
  }
};

export const getForumPosts = async (activeGroup, page) => {
  try {
    const response = await client.get(
      `/posts/post/?group=${activeGroup}&page=${page}`
    );
    const postWithComments = response.data.results.map((post) => ({
      ...post,
      // API 응답에 댓글 수가 포함되어 있다면 직접 사용하고,
      // 그렇지 않은 경우 comment 배열의 길이 등으로 계산
      commentCount: post.comment?.length || 0
    }));
    return {
      postWithComments,
      totalCount: response.data.count // 전체 포스트 수
    };
  } catch (error) {
    console.error("포럼 게시물 목록을 가져오는 데 실패했습니다:", error);
    throw error;
  }
};

export const getTargetPost = async (id) => {
  try {
    const response = await client.get(`/posts/post/${id}`);
    return response.data;
  } catch (error) {
    console.log("게시글 상세정보 가져오는 중 오류발생", error);
    throw error;
  }
};

export const deleteComment = async (id) => {
  try {
    const response = await client.delete(`/posts/comment/${id}`);
    return response.data;
  } catch (error) {
    console.error("댓글 삭제 실패", error);
    throw error;
  }
};

export const deletePost = async (id) => {
  try {
    const response = await client.delete(`/posts/post/${id}`);
    return response.data;
  } catch (error) {
    console.error("게시글 삭제 실패", error);
    throw error;
  }
};

export const addComment = async (newComment) => {
  try {
    const response = await client.post("/posts/comment/", newComment);
    return response.data; // 성공적으로 댓글을 추가한 후의 데이터 반환
  } catch (error) {
    console.error("댓글 추가 실패:", error);
    throw error; // 에러를 다시 던져서 호출자가 처리할 수 있도록 함
  }
};

// 상세 페이지 정보를 가져오는 함수
export const fetchPostDetail = async (id) => {
  try {
    const response = await client.get(`/posts/post/${id}`);
    return response.data;
  } catch (error) {
    console.error("상세 정보를 불러오는데 실패했습니다.", error);
    throw error;
  }
};

//관련 댓글 데이터를 가져오는 함수
export const fetchComments = async () => {
  try {
    const response = await client.get(`/posts/comment/`);
    return response.data;
  } catch (error) {
    console.error("댓글 데이터를 불러오는데 실패했습니다.", error);
    throw error;
  }
};

//DiaryEditor.jsx
export const createDiary = async (postData) => {
  await client.post(`/posts/post/`, postData);
};

export const updateDiary = async (id, postData) => {
  await client.put(`/posts/post/${id}/`, postData);
};

//jwtUtils
export const fetchUserInfo = async (token) => {
  try {
    const response = await client.get(`/accounts/update`);
    return response.data;
  } catch (error) {
    throw error;
  }
};

export const UpdateVoice = async (postVoice) => {
  await client.put(`/accounts/myvoice/`, postVoice);
};

//마이페이지 - 내가 작성한 게시글 불러오는 함수
export const getMyForumPosts = async (page) => {
  try {
    const response = await client.get(`/accounts/mypost/?page=${page}`);
    const postWithComments = response.data.results.map((post) => ({
      ...post,
      // API 응답에 댓글 수가 포함되어 있다면 직접 사용하고,
      // 그렇지 않은 경우 comment 배열의 길이 등으로 계산
      commentCount: post.comment?.length || 0
    }));
    return {
      postWithComments,
      totalCount: response.data.total // 전체 포스트 수
    };
  } catch (error) {
    console.error("내가 작성한 게시물 목록을 가져오는 데 실패했습니다:", error);
    throw error;
  }
};

// 사용자 목소리 정보 받아오기
export const voiceInfo = async () => {
  try {
    const response = await client.get(`/accounts/myvoice/`);
    //console.log(response.data);
    return {
      user_speed: response.data.data.speed,
      user_pitch: response.data.data.pitch,
      user_type: response.data.data.type
    };
  } catch (error) {
    console.error("보이스 정보를 가져오는데 실패했습니다.", error);
    throw error;
  }
};

//  생성한 음성 재생
export const playVoice = async (text, speed, pitch, type) => {
  try {
    const response = await client.get(
      `/posts/tts/?text=${text}&speed=${speed}&pitch=${pitch}&type=${type}`,
      { responseType: "blob" }
    );
    const blob = new Blob([response.data], { type: "audio/wav" });

    // Blob URL 생성
    const blobUrl = URL.createObjectURL(blob);

    // Audio 객체 생성 및 재생
    new Audio(blobUrl).play();
  } catch (error) {
    console.error("음성 재생 중 오류 발생:", error);
  }
};

export const forumPlayInfo = async (content, speed, pitch, type) => {
  try {
    await playVoice(content, speed, pitch, type);
  } catch (error) {
    console.error("게시글 음성 재생 중 오류 발생:", error);
  }
};

//마이페이지에서 게시글마다의 댓글을 음성으로 변환 및 저장하는 api
export const postMyTracklist = async (postId) => {
  try {
    const response = await client.post(`/posts/Mp3File/${postId}/`);
    return response.data; // 성공적으로 댓글을 추가한 후의 데이터 반환
  } catch (error) {
    console.error("댓글 음성 변환에 실패했습니다.", error);
    throw error;
  }
};

//마이페에지에서 보이스 댓글 url 쭉 받아오는 api
export const getMyTracklist = async (postId) => {
  try {
    const response = await client.get(`/posts/Mp3File/${postId}/`);

    return response.data;
  } catch (error) {
    console.error("댓글 음성을 불러오는 데 실패했습니다.", error);
    throw error;
  }
};

//댓글 좋아요
export const goodVoice = async (commentId) => {
  try {
    const response = await client.post(`/posts/comment/${commentId}/likes/`);
    return response.data;
  } catch (error) {
    console.error("댓글 좋아요에 실패했습니다.", error);
    throw error;
  }
};

//댓글 좋아요 취소
export const deleteGood = async (commentId) => {
  try {
    const response = await client.delete(`/posts/comment/${commentId}/likes/`);
    return response.data;
  } catch (error) {
    console.error("댓글 좋아요 취소에 실패했습니다.", error);
    throw error;
  }
};

//좋아요 통계 불러오기
export const voiceStatistic = async () => {
  try {
    const response = await client.get(`/accounts/likelist/`);
    return {
      recommend_speed: response.data.speed_avg,
      recommend_pitch: response.data.pitch_avg,
      recommend_type: response.data.type_avg
    };
  } catch (error) {
    console.error("댓글 좋아요 취소에 실패했습니다.", error);
    throw error;
  }
};
