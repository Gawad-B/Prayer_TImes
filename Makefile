EXT_UUID  = prayer-times@gawad-b.github.io
EXT_DIR   = $(HOME)/.local/share/gnome-shell/extensions/$(EXT_UUID)
SCHEMA_NS = org.gnome.shell.extensions.prayer-times
SCHEMA_DIR = schemas

.PHONY: build install schema uninstall package clean

build:
	npm run build

schema:
	glib-compile-schemas $(SCHEMA_DIR)/

install: build schema
	mkdir -p $(EXT_DIR)
	cp -r dist/* $(EXT_DIR)/
	mkdir -p $(EXT_DIR)/schemas
	cp $(SCHEMA_DIR)/$(SCHEMA_NS).gschema.xml $(EXT_DIR)/schemas/
	glib-compile-schemas $(EXT_DIR)/schemas/
	@echo "Installed to $(EXT_DIR)"
	@echo "Restart GNOME Shell (Alt+F2 → r) or log out/in to activate."

uninstall:
	rm -rf $(EXT_DIR)

package: build schema
	mkdir -p packages
	cd dist && zip -r ../packages/$(EXT_UUID).zip .
	@echo "Package: packages/$(EXT_UUID).zip"

clean:
	rm -rf dist packages node_modules