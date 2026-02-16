<?php
/**
 * Plugin Name: Pimpit.ro Catalog B2B
 * Description: Integrează catalogul de piese auto (React App) în WordPress.
 * Version: 1.0
 * Author: Pimpit Dev
 */

function pimpit_catalog_shortcode() {
    // Întoarcem div-ul rădăcină unde se va monta aplicația React
    // Asigurați-vă că fișierele JS/CSS din build-ul Vite sunt încărcate în header sau footer.
    return '<div id="root" class="pimpit-catalog-container"></div>';
}
add_shortcode('pimpit_catalog', 'pimpit_catalog_shortcode');

function pimpit_enqueue_scripts() {
    // NOTĂ: Aceste căi trebuie actualizate după ce faceți build la aplicația React (npm run build).
    // Copiați fișierele din dist/assets în folderul pluginului sau tema copil.
    
    // Exemplu (trebuie adaptat la numele reale ale fișierelor generate de Vite):
    // wp_enqueue_script('pimpit-react', plugin_dir_url(__FILE__) . 'assets/index.js', array(), '1.0', true);
    // wp_enqueue_style('pimpit-style', plugin_dir_url(__FILE__) . 'assets/index.css', array(), '1.0');
}
// Decomentați linia de mai jos după ce adăugați fișierele de build
// add_action('wp_enqueue_scripts', 'pimpit_enqueue_scripts');
?>