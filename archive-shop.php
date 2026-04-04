<?php get_header(); ?>

<main id="main_content" class="l-main_content l-article">
    <div class="area-archive-container">

        <div class="area-breadcrumb">
            <a href="<?php echo home_url('/'); ?>">ホーム</a> &gt; 
            <span class="current">店舗一覧（エリア選択）</span>
        </div>

        <h1 class="archive-title">エリアから探す</h1>
        <p class="archive-desc">ご希望のエリアを選択してください。</p>

			<?php echo do_shortcode('[kansai_area_list show_title="false"]'); ?>

    </div>
</main>
<?php get_footer(); ?>