"use client";

import { useState, type FormEvent } from "react";

export function HomeShopSearch() {
  const [message, setMessage] = useState("");

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    const form = event.currentTarget;
    const query = String(new FormData(form).get("q") ?? "").trim();
    if (query) {
      setMessage("");
      return;
    }
    event.preventDefault();
    setMessage("エリア名、駅名、店舗名のいずれかを入力してください。");
  }

  return (
    <>
      <form className="escomi-home-search-v2" action="/shops/" method="get" role="search" onSubmit={handleSubmit}>
        <label className="sr-only" htmlFor="home-shop-search">
          エリア名・駅名・店舗名で探す
        </label>
        <input
          id="home-shop-search"
          className="escomi-home-search-v2__input"
          type="search"
          name="q"
          placeholder="エリア名・駅名・店舗名で探す"
          autoComplete="off"
        />
        <button className="escomi-home-search-v2__button" type="submit">検索</button>
      </form>
      {message ? <p className="escomi-home-search-message" role="status">{message}</p> : null}
    </>
  );
}
