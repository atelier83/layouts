import { createLayout } from "../src/index";
import "../src/theme.css";

const engine = createLayout({
  layout: {
    direction: "row",
    children: [
      { id: "canvas", title: "Canvas" },
      { id: "panel1", title: "Panel 1", min: 200, max: 400, size: 300 },
      { id: "panel2", title: "Panel 2", min: 200, max: 400, size: 300 },
    ],
  },
});

engine.getPanelElement("canvas").innerHTML =
  `<div class="panel-body"><strong>Canvas</strong></div>`;

engine.getPanelElement("panel1").innerHTML =
  `<div class="panel-body"><strong>Panel 1</strong></div>`;

engine.getPanelElement("panel2").innerHTML =
  `<div class="panel-body"><strong>Panel 2</strong></div>`;

engine.mount(document.getElementById("app")!);
