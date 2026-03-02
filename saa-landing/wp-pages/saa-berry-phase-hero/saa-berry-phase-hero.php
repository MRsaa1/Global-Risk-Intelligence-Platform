<?php
/**
 * Plugin Name: SAA Berry Phase Hero
 * Description: Berry Phase на How it works, circuit-анимация на Platform. Всё внутри плагина — ничего вручную копировать не нужно.
 * Version: 1.0.2
 */

if ( ! defined( 'ABSPATH' ) ) {
	exit;
}

add_action( 'wp_enqueue_scripts', 'saa_berry_phase_hero_enqueue', 20 );

function saa_berry_phase_hero_enqueue() {
	$plugin_url  = plugin_dir_url( __FILE__ );
	$plugin_path = plugin_dir_path( __FILE__ );

	// How it works: Berry Phase canvas
	if ( is_page( 'how-it-works' ) ) {
		$script_file = 'berry-phase-hero.js';
		if ( file_exists( $plugin_path . $script_file ) ) {
			wp_enqueue_script(
				'berry-phase-hero',
				$plugin_url . $script_file,
				array(),
				'1.0.2',
				true
			);
		}
	}

	// Platform: circuit/wires hero canvas
	if ( is_page( 'platform' ) ) {
		$platform_script = 'platform-hero-canvas.js';
		if ( file_exists( $plugin_path . $platform_script ) ) {
			wp_enqueue_script(
				'platform-hero-canvas',
				$plugin_url . $platform_script,
				array(),
				'1.0.2',
				true
			);
		}
	}

	// Investment Dashboard: Phase Clocks — подключаем на всех страницах; скрипт сам найдёт #heroCanvasInvest и запустится только если он есть
	$invest_script = 'investment-dashboard-hero.js';
	if ( file_exists( $plugin_path . $invest_script ) ) {
		wp_enqueue_script(
			'investment-dashboard-hero',
			$plugin_url . $invest_script,
			array(),
			'1.0.2',
			true
		);
	}
}
