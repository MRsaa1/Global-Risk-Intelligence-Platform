<?php
if ( ! defined( 'ABSPATH' ) ) {
	exit;
}
/**
 * Подключение berry-phase-hero.js только на странице How it works.
 * Без темы: всё через uploads + mu-plugins.
 *
 * ЧТО СДЕЛАТЬ:
 * 1) Создать папку wp-content/uploads/saa/ и положить туда berry-phase-hero.js
 *    (через FTP или файловый менеджер хостинга; в Медиафайлы .js не всегда разрешён).
 * 2) Положить этот файл в wp-content/mu-plugins/enqueue-berry-phase-hero.php
 *
 * В виджете Elementor на странице How it works — только HTML из how-it-works.html (без <script>).
 */

add_action( 'wp_enqueue_scripts', 'saa_enqueue_berry_phase_hero_on_how_it_works', 20 );

function saa_enqueue_berry_phase_hero_on_how_it_works() {
	if ( ! is_page( 'how-it-works' ) ) {
		return;
	}

	$upload = wp_upload_dir();
	$baseurl = $upload['baseurl'];
	$basedir = $upload['basedir'];
	$rel     = '/saa/berry-phase-hero.js';

	$script_url  = $baseurl . $rel;
	$script_path = $basedir . $rel;

	if ( ! file_exists( $script_path ) ) {
		return;
	}

	wp_enqueue_script(
		'berry-phase-hero',
		$script_url,
		array(),
		'1.0.0',
		true
	);
}
