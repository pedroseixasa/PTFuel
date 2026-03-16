// the point of separating elements from their handlers is flexibility
const elements = {};
const handlers = {};

// We could also export a single object with these two...
export const bind = (event, handler) => (handlers[event] = handler);

export const render = (combustivel) => {
    elements.app = $("#app");

    if (combustivel) {
        renderFilm(combustivel);
    };
};
