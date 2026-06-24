/**
 * Plugin settings tab.
 */

import { PluginSettingTab, Setting, App } from "obsidian";
import type PretextJustifyPlugin from "./main";
import type { JustifySettings } from "./renderer";

export const DEFAULT_SETTINGS: JustifySettings = {
	enabled: true,
	hyphenate: true,
	greedyFallback: true,
	minSpacingRatio: 0.5,
	tightPenaltyThreshold: 0.75,
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

		containerEl.createEl("h2", { text: "Pretext Justify" });

		new Setting(containerEl)
			.setName("Enable justification")
			.setDesc(
				"Apply Knuth-Plass optimal justification to reading view paragraphs.",
			)
			.addToggle((toggle) =>
				toggle
					.setValue(this.plugin.settings.enabled)
					.onChange(async (value) => {
						this.plugin.settings.enabled = value;
						await this.plugin.saveSettings();
						this.plugin.refresh();
					}),
			);

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
					.setTooltip("Restore default")
					.onClick(async () => {
						this.plugin.settings.minSpacingRatio = DEFAULT_SETTINGS.minSpacingRatio;
						await this.plugin.saveSettings();
						this.plugin.refresh();
						this.display();
					});
			})
			.addSlider((slider) => {
				slider
					.setLimits(0.3, 0.9, 0.05)
					.setValue(this.plugin.settings.minSpacingRatio)
					.setDynamicTooltip()
					.onChange(async (value) => {
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
					.setTooltip("Restore default")
					.onClick(async () => {
						this.plugin.settings.tightPenaltyThreshold = DEFAULT_SETTINGS.tightPenaltyThreshold;
						await this.plugin.saveSettings();
						this.plugin.refresh();
						this.display();
					});
			})
			.addSlider((slider) => {
				slider
					.setLimits(0.5, 1.0, 0.05)
					.setValue(this.plugin.settings.tightPenaltyThreshold)
					.setDynamicTooltip()
					.onChange(async (value) => {
						this.plugin.settings.tightPenaltyThreshold = value;
						await this.plugin.saveSettings();
						this.plugin.refresh();
					});
			});
	}
}
