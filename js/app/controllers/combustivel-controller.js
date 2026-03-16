import { bind, render } from "../views/combustivel-view.js";
import getFilm from "../services/combustivel-service.js";

const bindEventHandlers = () => bind("button", buttonHandler);

const buttonHandler = () => {
    const combustivelIndex = Math.floor(Math.random() * 6);
    getFilm(combustivelIndex, (combustivel) => render(combustivel));
};

export const start = () => {
    bindEventHandlers();
    render();
};
