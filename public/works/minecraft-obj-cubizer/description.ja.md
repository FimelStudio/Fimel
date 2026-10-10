# Minecraft OBJ Cubizer

Minecraft の建築を、編集可能な Blockbench の Java ブロックモデルへ読み込むプラグインです。

## 対応形式

- MTL / PNG テクスチャを含む OBJ。
- `.schematic`、`.schem`、`.litematic`、構造 `.nbt`、単一の `.mca` リージョンファイル。
- バニラやリソースパックの blockstate / model JSON。ハーフブロック、階段、フェンス、壁、ボタン、松明などに対応。

## 制作フロー

Blockbench に **Minecraft Cubizer** メニューを追加します。構造の読み込み、フォルダーや Minecraft Jar / Zip からのテクスチャ選択、パスの修正、リソースパックへの OBJ テクスチャ出力ができます。

## 制限

チェストの中身、看板の文字、旗の模様、カスタム頭部などのブロックエンティティ情報は読み込みません。既定の上限は生成後の Blockbench cube 5,000 個です。Java Block / Item モデルは小さくまとめることを推奨し、原文の目安は約 48 × 48 × 48 ブロックです。

Blockbench Desktop 4.8.0 以降が必要です。

