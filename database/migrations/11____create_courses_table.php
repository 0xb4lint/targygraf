<?php

use Illuminate\Support\Facades\Schema;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Database\Migrations\Migration;

class CreateCoursesTable extends Migration
{
    /**
     * Run the migrations.
     *
     * @return void
     */
    public function up()
    {
        Schema::create('courses', function (Blueprint $table) {
            $table->increments('id');

            $table->integer('course_block_id')->unsigned()->nullable();
            $table->foreign('course_block_id')->references('id')->on('course_blocks');

            $table->string('code', 50)->nullable();
            $table->string('name')->nullable();
            $table->tinyInteger('ordering')->unsigned()->default(0);

            $table->tinyInteger('credits')->unsigned()->default(0);
        });
    }

    /**
     * Reverse the migrations.
     *
     * @return void
     */
    public function down()
    {
        Schema::dropIfExists('courses');
    }
}
