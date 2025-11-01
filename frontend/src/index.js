import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import "./index.css";
import { ToastProvider } from './components/ToastProvider';

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
	<ToastProvider>
		<App />
	</ToastProvider>
);
