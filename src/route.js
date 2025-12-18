import WorkSpaceLayout from "./WorkSpaceLayout.jsx";

const routes = [
  {
    path: "/chat",
    component: WorkSpaceLayout,
    tab: "Chat",
  },
  {
    path: "/chat/:chatId",
    component: WorkSpaceLayout,
    tab: "Chat",
  },
  {
    path: "/training",
    component: WorkSpaceLayout,
    tab: "Training",
  },
  {
    path: "/training/:chatId",
    component: WorkSpaceLayout,
    tab: "Training",
  },
  {
    path: "/livedemo",
    component: WorkSpaceLayout,
    tab: "Live Demo",
  },
  {
    path: "/livedemo/:chatId",
    component: WorkSpaceLayout,
    tab: "Live Demo",
  },
];

export default routes;
