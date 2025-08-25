import React from "react";
import ReactDOM from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./styles/index.css";
import Root from "./pages/Root";
import Plan from "./pages/Plan";

const router = createBrowserRouter([
  { path: "/", element: <Root /> },
  { path: "/plan", element: <Plan /> },
]);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);
