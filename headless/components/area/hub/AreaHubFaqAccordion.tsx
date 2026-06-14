"use client";

import { useId, useState } from "react";

export function AreaHubFaqAccordion({
  items
}: {
  items: Array<{ question: string; answer: string }>;
}) {
  const baseId = useId();
  const [openIndex, setOpenIndex] = useState<number | null>(0);

  return (
    <div className="area-hub-faq-accordion">
      {items.map((item, index) => {
        const open = openIndex === index;
        const panelId = `${baseId}-panel-${index}`;
        const buttonId = `${baseId}-btn-${index}`;

        return (
          <article key={item.question} className="area-hub-faq-accordion__item">
            <h3 className="area-hub-faq-accordion__question">
              <button
                type="button"
                id={buttonId}
                className="area-hub-faq-accordion__trigger"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => setOpenIndex(open ? null : index)}
              >
                <span>{item.question}</span>
                <span className="area-hub-faq-accordion__chevron" aria-hidden="true" />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={buttonId}
              className={`area-hub-faq-accordion__panel ${open ? "is-open" : ""}`.trim()}
              hidden={!open}
            >
              <p>{item.answer}</p>
            </div>
          </article>
        );
      })}
    </div>
  );
}
