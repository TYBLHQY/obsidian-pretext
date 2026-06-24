/**
 * Plugin settings tab.
 */

import { PluginSettingTab, Setting, App } from "obsidian";
import type PretextJustifyPlugin from "./main";
import type { JustifySettings } from "./renderer";

export const DEFAULT_SETTINGS: JustifySettings = {
	hyphenate: true,
	greedyFallback: true,
	minSpacingRatio: 0.5,
	tightPenaltyThreshold: 0.75,
	minWidth: 100,
	maxCacheEntries: 200,
};

export class PretextJustifySettingTab extends PluginSettingTab {
	plugin: PretextJustifyPlugin;

	constructor(app: App, plugin: PretextJustifyPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const { containerEl } = this;
		containerEl.empty();

		// Heading intentionally omitted — plugin name is shown in sidebar

		new Setting(containerEl)
			.setName("Hyphenation")
			.setDesc(
				"Allow soft hyphens to produce more even spacing (recommended).",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.hyphenate)
					.onChange(async (value) => {
						this.plugin.settings.hyphenate = value;
						await this.plugin.saveSettings();
						this.plugin.refresh();
					}),
			);

		// -- Minimum spacing ratio slider --

		new Setting(containerEl)
			.setName("Minimum spacing ratio")
			.setDesc(
				"Lowest allowed word spacing, as a fraction of normal space. " +
				"Lower values may produce tighter lines but risk words appearing cramped. " +
				`Default: ${DEFAULT_SETTINGS.minSpacingRatio.toFixed(2)}.`,
			)
			.addExtraButton((btn) => {
				btn.setIcon("reset")
					.onClick(async () => {
						this.plugin.settings.minSpacingRatio = DEFAULT_SETTINGS.minSpacingRatio;
						await this.plugin.saveSettings();
						this.plugin.refresh();
						this.display();
					});
			})
			.addSlider((slider) => {
				const val = slider.sliderEl.parentElement!.createSpan({
					cls: "slider-value",
					text: this.plugin.settings.minSpacingRatio.toFixed(2),
				});
				slider.sliderEl.parentElement!.insertBefore(val, slider.sliderEl);
				slider
					.setInstant(true)
					.setLimits(0.3, 0.9, 0.05)
					.setValue(this.plugin.settings.minSpacingRatio)
					.onChange(async (value) => {
						val.textContent = value.toFixed(2);
						this.plugin.settings.minSpacingRatio = value;
						await this.plugin.saveSettings();
						this.plugin.refresh();
					});
			});

		// -- Tight penalty threshold slider --

		new Setting(containerEl)
			.setName("Tight penalty threshold")
			.setDesc(
				"Fraction of normal space below which the algorithm penalises tight lines. " +
				"Higher values produce more even spacing but may increase fallback to greedy layout. " +
				`Default: ${DEFAULT_SETTINGS.tightPenaltyThreshold.toFixed(2)}.`,
			)
			.addExtraButton((btn) => {
				btn.setIcon("reset")
					.onClick(async () => {
						this.plugin.settings.tightPenaltyThreshold = DEFAULT_SETTINGS.tightPenaltyThreshold;
						await this.plugin.saveSettings();
						this.plugin.refresh();
						this.display();
					});
			})
			.addSlider((slider) => {
				const val = slider.sliderEl.parentElement!.createSpan({
					cls: "slider-value",
					text: this.plugin.settings.tightPenaltyThreshold.toFixed(2),
				});
				slider.sliderEl.parentElement!.insertBefore(val, slider.sliderEl);
				slider
					.setInstant(true)
					.setLimits(0.5, 1.0, 0.05)
					.setValue(this.plugin.settings.tightPenaltyThreshold)
					.onChange(async (value) => {
						val.textContent = value.toFixed(2);
						this.plugin.settings.tightPenaltyThreshold = value;
						await this.plugin.saveSettings();
						this.plugin.refresh();
					});
			});

		// -- Cache size slider --

		new Setting(containerEl)
			.setName("Text cache size")
			.setDesc(
				"Number of paragraphs cached to avoid re-measurement on resize. " +
				"Larger values improve resize responsiveness at the cost of memory. " +
				`Default: ${DEFAULT_SETTINGS.maxCacheEntries}.`,
			)
			.addExtraButton((btn) => {
				btn.setIcon("reset")
					.onClick(async () => {
						this.plugin.settings.maxCacheEntries = DEFAULT_SETTINGS.maxCacheEntries;
						await this.plugin.saveSettings();
						this.plugin.refresh();
						this.display();
					});
			})
			.addSlider((slider) => {
				const val = slider.sliderEl.parentElement!.createSpan({
					cls: "slider-value",
					text: String(this.plugin.settings.maxCacheEntries),
				});
				slider.sliderEl.parentElement!.insertBefore(val, slider.sliderEl);
				slider
					.setInstant(true)
					.setLimits(50, 1000, 50)
					.setValue(this.plugin.settings.maxCacheEntries)
					.onChange(async (value) => {
						val.textContent = String(value);
						this.plugin.settings.maxCacheEntries = value;
						await this.plugin.saveSettings();
						this.plugin.refresh();
					});
			});
	}
}
