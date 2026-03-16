/**
 * Router Module
 */
// Would be nice to have this in a separate file and passed here later
const routes = {
    // film route
    film: {
        hash: "#portugal", // hash
        controller: "combustivel-controller", // controller
    },
    route2: {
        hash: "#route2",
        controller: "route2-controller",
    },
};

const defaultRoute = "portugal";

window.addEventListener("hashchange", () => {
    let routeName = Object.keys(routes).find(
        (name) => location.hash === routes[name].hash
    );

    if (!routeName) {
        routeName = defaultRoute;
        location.hash = routes[defaultRoute].hash;
    }

    loadController(routes[routeName].controller);
});


const loadController = async (controllerName) => {

    const controller = await import(`./controllers/${controllerName}.js`);

    try {
        controller.start();
    } catch (err) {
        console.log(err.stack);
        location.hash = routes[defaultRoute].hash;
    }
};

export const routerStart = () => {
    location.hash = routes[defaultRoute].hash;
    loadController(routes[defaultRoute].controller);
};
