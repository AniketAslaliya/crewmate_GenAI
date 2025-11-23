import axios from "axios";

const papi = axios.create({
  baseURL: process.env.REACT_APP_PBACKEND_URL,
  withCredentials: true,
});

export default papi;