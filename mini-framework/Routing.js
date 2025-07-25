/**
 * @fileoverview Simple routing system for mini-framework
 * @version 0.0.1
 * @author Sagyn, Saddam Hussain, Ejmilli, Chan
 */

// Store all routes
const routes = new Map();

/**
 * Add a route
 */
export function addRoute(path, handler) {
    if (typeof path === 'string' && typeof handler === 'function') {
        routes.set(path, handler);
        return true;
    }
    return false;
}

/**
 * Execute a route handler
 */
export function executeRoute(url) {
    // Clean up URL (remove # if present)
    const cleanUrl = url.startsWith('#') ? url.substring(1) : url;
    
    // Find and execute the route handler
    const handler = routes.get(cleanUrl) || routes.get('/');
    
    if (handler) {
        handler();
    }
    
    // Update browser hash if needed
    if (window.location.hash !== '#' + cleanUrl) {
        window.location.hash = cleanUrl;
    }
}

/**
 * Get all registered routes
 */
export function getAllRoutes() {
    return Array.from(routes.keys());
}
