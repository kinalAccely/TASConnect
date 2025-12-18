import React from "react";
import ChatSectionLight from "./light/ChatSection.jsx";
import ChatSectionDark from "./dark/ChatSection.jsx";

export default function ChatSection(props) {
  const { theme = "light", ...rest } = props;

  if (theme === "dark") {
    return <ChatSectionDark {...rest} theme="dark" />;
  }

  return <ChatSectionLight {...rest} theme="light" />;
}
