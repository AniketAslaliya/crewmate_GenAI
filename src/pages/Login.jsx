
const backendUrl = process.env.REACT_APP_BACKEND_URL;

const Login = () => {
  return (
    <main className="flex flex-col items-center justify-center min-h-screen">
      <h1 className="text-3xl font-bold mb-4">Login</h1>
      <a
        href={`${backendUrl}/auth/google`}
        className="bg-blue-500 text-white px-4 py-2 rounded"
      >
        Login with Google
      </a>
    </main>
  );
};

export default Login;