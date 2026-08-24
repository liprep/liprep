import { Route, Routes } from "react-router-dom";
import Home from "@/pages/Home";
import Practice from "@/pages/Practice";
import Filter from "@/pages/Filter";
import AppLoader from "@/components/AppLoader";
import "./App.css";

export default function App() {
  return (
    <AppLoader>
      <div className="liprep-app-frame">
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/practice" element={<Practice />} />
          <Route path="/practice/:questionId" element={<Practice />} />
          <Route path="/filter" element={<Filter />} />
        </Routes>
      </div>
    </AppLoader>
  );
}
