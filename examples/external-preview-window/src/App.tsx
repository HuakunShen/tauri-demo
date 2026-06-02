import { HistoryWindow } from "./routes/HistoryWindow";
import { PreviewWindow } from "./routes/PreviewWindow";
import "./App.css";

function App() {
  if (window.location.hash.includes("/preview")) {
    return <PreviewWindow />;
  }

  return <HistoryWindow />;
}

export default App;
