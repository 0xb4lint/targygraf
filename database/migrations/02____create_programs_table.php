<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

class CreateProgramsTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('programs', function (Blueprint $table) {
            $table->increments('id');

            $table->integer('faculty_id')->unsigned();
            $table->foreign('faculty_id')->references('id')->on('faculties');

            $table->string('name');
            $table->string('slug', 50)->collation('ascii_bin')->index();

            $table->string('description')->nullable();
            $table->date('curriculum_updated_at')->nullable();
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('programs');
    }
}
